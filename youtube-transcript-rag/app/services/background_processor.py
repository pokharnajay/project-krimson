"""
Background Task Processor for Asynchronous Source Processing

This module provides background task processing using Python threading.
Can be easily migrated to Celery/RQ for production scale.

Usage:
    processor = BackgroundProcessor()
    processor.start()
    processor.submit_task(task_function, *args, **kwargs)
"""

import threading
import queue
import time
from typing import Callable, Any
from app.utils.logger import log_info, log_error, log_debug


class BackgroundProcessor:
    """
    Background task processor using threading and queue.
    Processes tasks asynchronously without blocking the request handler.
    """

    def __init__(self, num_workers=2):
        """
        Initialize background processor with worker threads.

        Args:
            num_workers: Number of worker threads (default: 2)
        """
        self.task_queue = queue.Queue()
        self.num_workers = num_workers
        self.workers = []
        self.running = False
        log_debug(f"BackgroundProcessor initialized with {num_workers} workers")

    def start(self):
        """Start worker threads"""
        if self.running:
            log_debug("BackgroundProcessor already running")
            return

        self.running = True
        for i in range(self.num_workers):
            worker = threading.Thread(
                target=self._worker_loop,
                name=f"BackgroundWorker-{i}",
                daemon=True  # Daemon threads exit when main thread exits
            )
            worker.start()
            self.workers.append(worker)
            log_info(f"Started background worker: BackgroundWorker-{i}")

    def stop(self):
        """Stop all worker threads (graceful shutdown)"""
        if not self.running:
            return

        log_info("Stopping background processor...")
        self.running = False

        # Add None tasks to wake up workers and let them exit
        for _ in range(self.num_workers):
            self.task_queue.put(None)

        # Wait for all workers to finish
        for worker in self.workers:
            worker.join(timeout=5)

        self.workers.clear()
        log_info("Background processor stopped")

    def submit_task(self, task_func: Callable, *args, **kwargs) -> bool:
        """
        Submit a task to be processed in the background.

        Args:
            task_func: Function to execute
            *args: Positional arguments for the task function
            **kwargs: Keyword arguments for the task function

        Returns:
            True if task was submitted successfully
        """
        if not self.running:
            log_error("Cannot submit task: BackgroundProcessor not running")
            return False

        try:
            task = {
                'func': task_func,
                'args': args,
                'kwargs': kwargs,
                'submitted_at': time.time()
            }
            self.task_queue.put(task)
            log_debug(f"Task submitted: {task_func.__name__}")
            return True
        except Exception as e:
            log_error(f"Failed to submit task: {str(e)}")
            return False

    def _worker_loop(self):
        """
        Worker thread main loop.
        Continuously processes tasks from the queue.
        """
        worker_name = threading.current_thread().name
        log_debug(f"{worker_name} started")

        while self.running:
            try:
                # Wait for a task (blocks until available)
                task = self.task_queue.get(timeout=1)

                # None is the signal to exit
                if task is None:
                    log_debug(f"{worker_name} received shutdown signal")
                    break

                # Execute the task
                task_func = task['func']
                task_args = task['args']
                task_kwargs = task['kwargs']

                log_debug(f"{worker_name} processing task: {task_func.__name__}")
                start_time = time.time()

                try:
                    task_func(*task_args, **task_kwargs)
                    elapsed = time.time() - start_time
                    log_info(f"{worker_name} completed {task_func.__name__} in {elapsed:.2f}s")
                except Exception as task_error:
                    log_error(f"{worker_name} task {task_func.__name__} failed: {str(task_error)}", exc_info=True)
                finally:
                    self.task_queue.task_done()

            except queue.Empty:
                # Timeout, continue loop to check if still running
                continue
            except Exception as e:
                log_error(f"{worker_name} error in worker loop: {str(e)}", exc_info=True)

        log_debug(f"{worker_name} exiting")

    def get_queue_size(self) -> int:
        """Get number of pending tasks in queue"""
        return self.task_queue.qsize()

    def is_running(self) -> bool:
        """Check if processor is running"""
        return self.running


# Global background processor instance (singleton)
_background_processor = None


def get_background_processor() -> BackgroundProcessor:
    """
    Get or create the global background processor instance.

    Returns:
        BackgroundProcessor instance
    """
    global _background_processor

    if _background_processor is None:
        _background_processor = BackgroundProcessor(num_workers=2)
        _background_processor.start()

    return _background_processor


def submit_background_task(task_func: Callable, *args, **kwargs) -> bool:
    """
    Convenience function to submit a task to the global background processor.

    Args:
        task_func: Function to execute in background
        *args: Positional arguments
        **kwargs: Keyword arguments

    Returns:
        True if task was submitted successfully
    """
    processor = get_background_processor()
    return processor.submit_task(task_func, *args, **kwargs)

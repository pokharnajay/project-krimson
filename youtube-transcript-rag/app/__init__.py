from flask import Flask, jsonify
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from config.settings import Config
from app.utils.logger import log_info, log_error
from pydantic import ValidationError

jwt = JWTManager()
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[Config.RATELIMIT_DEFAULT] if Config.RATELIMIT_ENABLED else [],
    storage_uri=Config.RATELIMIT_STORAGE_URL
)


def create_app():
    """Create and configure Flask application"""
    app = Flask(__name__)
    app.config.from_object(Config)

    # Initialize extensions
    jwt.init_app(app)
    CORS(app, origins=Config.CORS_ORIGINS)

    # Initialize rate limiter if enabled
    if Config.RATELIMIT_ENABLED:
        limiter.init_app(app)
        log_info(f"Rate limiting enabled: {Config.RATELIMIT_DEFAULT}")
    else:
        log_info("Rate limiting disabled")

    # Register error handlers
    register_error_handlers(app)

    # Register blueprints
    from app.routes.auth_routes import auth_bp
    from app.routes.transcript_routes import transcript_bp
    from app.routes.query_routes import query_bp
    from app.routes.user_routes import user_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(transcript_bp, url_prefix='/api/transcripts')
    app.register_blueprint(query_bp, url_prefix='/api/query')
    app.register_blueprint(user_bp, url_prefix='/api/user')

    # Health check endpoint
    @app.route('/health', methods=['GET'])
    def health_check():
        """Health check endpoint for monitoring"""
        return jsonify({
            'status': 'healthy',
            'service': 'youtube-transcript-rag-api',
            'version': '1.0.0'
        }), 200

    # Root endpoint
    @app.route('/', methods=['GET'])
    def root():
        """Root endpoint with API information"""
        return jsonify({
            'service': 'YouTube Transcript RAG API',
            'version': '1.0.0',
            'status': 'running',
            'endpoints': {
                'health': '/health',
                'auth': '/api/auth',
                'transcripts': '/api/transcripts',
                'query': '/api/query',
                'user': '/api/user'
            }
        }), 200

    log_info("Flask application initialized successfully")
    return app


def register_error_handlers(app):
    """Register global error handlers"""

    @app.errorhandler(ValidationError)
    def handle_validation_error(e):
        """Handle Pydantic validation errors"""
        log_error(f"Validation error: {str(e)}")
        return jsonify({
            'error': 'ValidationError',
            'message': 'Request validation failed',
            'details': e.errors()
        }), 400

    @app.errorhandler(400)
    def handle_bad_request(e):
        """Handle bad request errors"""
        log_error(f"Bad request: {str(e)}")
        return jsonify({
            'error': 'BadRequest',
            'message': str(e)
        }), 400

    @app.errorhandler(401)
    def handle_unauthorized(e):
        """Handle unauthorized errors"""
        return jsonify({
            'error': 'Unauthorized',
            'message': 'Authentication required'
        }), 401

    @app.errorhandler(403)
    def handle_forbidden(e):
        """Handle forbidden errors"""
        return jsonify({
            'error': 'Forbidden',
            'message': 'Access denied'
        }), 403

    @app.errorhandler(404)
    def handle_not_found(e):
        """Handle not found errors"""
        return jsonify({
            'error': 'NotFound',
            'message': 'Resource not found'
        }), 404

    @app.errorhandler(429)
    def handle_rate_limit_exceeded(e):
        """Handle rate limit exceeded errors"""
        log_error(f"Rate limit exceeded: {str(e)}")
        return jsonify({
            'error': 'RateLimitExceeded',
            'message': 'Too many requests. Please try again later.'
        }), 429

    @app.errorhandler(500)
    def handle_internal_error(e):
        """Handle internal server errors"""
        log_error(f"Internal server error: {str(e)}")
        return jsonify({
            'error': 'InternalServerError',
            'message': 'An internal error occurred. Please try again later.'
        }), 500

    @app.errorhandler(Exception)
    def handle_unexpected_error(e):
        """Handle unexpected errors"""
        log_error(f"Unexpected error: {str(e)}", exc_info=True)
        return jsonify({
            'error': 'UnexpectedError',
            'message': 'An unexpected error occurred. Please try again later.'
        }), 500

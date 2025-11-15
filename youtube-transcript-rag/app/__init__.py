from flask import Flask
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from config.settings import Config

jwt = JWTManager()

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Initialize extensions
    jwt.init_app(app)
    CORS(app)
    
    # Register blueprints
    from app.routes.auth_routes import auth_bp
    from app.routes.transcript_routes import transcript_bp
    from app.routes.query_routes import query_bp
    from app.routes.user_routes import user_bp  # NEW


    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(transcript_bp, url_prefix='/api/transcripts')
    app.register_blueprint(query_bp, url_prefix='/api/query')
    app.register_blueprint(user_bp, url_prefix='/api/user')  # NEW
    
    return app

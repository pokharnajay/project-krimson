from app.services.supabase_service import create_user

# Run this once to create test users
if __name__ == '__main__':
    print("Creating test users...")
    
    try:
        admin = create_user('admin', 'admin123')
        print(f"✓ Admin user created: {admin['username']}")
    except Exception as e:
        print(f"Admin user may already exist: {e}")
    
    try:
        test = create_user('testuser', 'test123')
        print(f"✓ Test user created: {test['username']}")
    except Exception as e:
        print(f"Test user may already exist: {e}")
    
    print("Done!")

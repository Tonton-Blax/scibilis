import { createUser } from './user-service';

export async function createAdminUser() {
    try {
        const adminUser = await createUser({
            username: 'admin',
            email: 'admin@example.com',
            name: 'Admin User',
            password: 'admin123',
            role: 'admin',
            bio: 'System administrator'
        });
        
        console.log('Admin user created successfully:', adminUser);
        return adminUser;
    } catch (error) {
        console.error('Error creating admin user:', error);
        throw error;
    }
}

// Run this function directly if this file is executed
if (import.meta.url === `file://${process.argv[1]}`) {
    createAdminUser()
        .then(() => {
            console.log('Admin user creation completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Admin user creation failed:', error);
            process.exit(1);
        });
}
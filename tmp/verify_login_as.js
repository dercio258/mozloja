const mockAdminRouter = require('../routes/admin');

async function testLoginAsRoute() {
    console.log('Testing Admin Login-As (Impersonation) logic...');
    
    const app = { locals: { adminAccessCode: 'SECRET123' } };
    
    // Mock User.findByPk
    const User = require('../models/User');
    const originalFindByPk = User.findByPk;
    User.findByPk = async (id) => {
        if (id === 'user-456') return { id: 'user-456', email: 'test@user.com' };
        return null;
    };

    const testCases = [
        { params: { userId: 'user-456' }, query: { code: 'SECRET123' }, expectedStatus: 302, expectedUserId: 'user-456' },
        { params: { userId: 'user-456' }, query: { code: 'WRONG' }, expectedStatus: 403, expectedUserId: undefined },
        { params: { userId: 'non-existent' }, query: { code: 'SECRET123' }, expectedStatus: 404, expectedUserId: undefined }
    ];

    for (const tc of testCases) {
        let status = 200;
        let redirectUrl = '';
        let session = {};
        
        const req = { params: tc.params, query: tc.query, app: app, session: session };
        const res = {
            status: (s) => { status = s; return res; },
            send: (m) => { return res; },
            redirect: (url) => { status = 302; redirectUrl = url; return res; }
        };

        const handler = mockAdminRouter.stack.find(s => s.route && s.route.path === '/login-as/:userId').route.stack[0].handle;
        
        await handler(req, res);
        
        const statusPassed = status === tc.expectedStatus;
        const sessionPassed = tc.expectedUserId ? session.userId === tc.expectedUserId : true;
        
        console.log(`User: ${tc.params.userId} | Code: ${tc.query.code} | Status: ${status} | Session: ${session.userId || 'None'} | ${statusPassed && sessionPassed ? '✅' : '❌'}`);
    }

    // Restore original
    User.findByPk = originalFindByPk;
}

testLoginAsRoute().catch(console.error);

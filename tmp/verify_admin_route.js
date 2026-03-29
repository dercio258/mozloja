// Mock the req and res objects to test admin route logic
const mockAdminRouter = require('../routes/admin');

async function testAdminRoute() {
    console.log('Testing Admin Route access logic...');
    
    // Simulating app.locals.adminAccessCode = 'TESTCODE123'
    const app = { locals: { adminAccessCode: 'TESTCODE123' } };
    
    const testCases = [
        { query: { code: 'TESTCODE123' }, expectedStatus: 200 },
        { query: { code: 'WRONGCODE' }, expectedStatus: 403 },
        { query: {}, expectedStatus: 403 }
    ];

    for (const tc of testCases) {
        let status = 200;
        let sent = false;
        
        const req = { query: tc.query, app: app };
        const res = {
            status: (s) => { status = s; return res; },
            send: (m) => { sent = true; return res; },
            render: (v, d) => { sent = true; return res; }
        };

        // Manual execution of the route handler
        // Since it's a router.get('/users', ...), we need to extract the handler
        const handler = mockAdminRouter.stack.find(s => s.route && s.route.path === '/users').route.stack[0].handle;
        
        await handler(req, res);
        
        const passed = status === tc.expectedStatus;
        console.log(`Code: "${tc.query.code || 'None'}" | Expected: ${tc.expectedStatus} | Actual: ${status} | ${passed ? '✅' : '❌'}`);
    }
}

testAdminRoute().catch(console.error);

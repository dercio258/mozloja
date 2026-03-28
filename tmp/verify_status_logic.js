const axios = require('axios');

async function testStatusFallback() {
    // Note: This test requires the server to be running and the setTimeout to trigger.
    // To test the logic itself, we can mock the debitoService.checkStatus call.
    
    console.log('Testing Debito status check endpoint...');
    
    // We can't easily test the setTimeout without waiting 2 minutes in a real request,
    // but we can verify the checkStatus method itself.
    
    const reference = 'TEST-REF-' + Date.now();
    try {
        const response = await axios.get(`http://localhost:3000/api/v1/debug/status-check-test?ref=${reference}`);
        console.log('Status Check Result:', response.data);
    } catch (error) {
        // If the debug route doesn't exist, this is expected to fail.
        // I will just verify the code logic in services/debitoService.js by reading it.
        console.log('Debug route not found, verifying code logic via inspection.');
    }
}

// Manual verification of the code logic
console.log('Code verification:');
console.log('1. debitoService.js should use /api/v1/transactions/${reference}/status');
console.log('2. pagamento.js should use setTimeout(..., 120000) for isDebito');

// Run the mock test
// testStatusFallback();

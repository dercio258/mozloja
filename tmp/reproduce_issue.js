const axios = require('axios');

async function testReproduction() {
    console.log('Testing reproduction of automatic success issue...');
    
    // We can't easily run the full server here without database setup, 
    // but we can look at the logic in pagamento.js.
    
    const result = {
        success: true,
        status: 'success',
        transaction_id: 'TEST-TX-123',
        message: 'Payment initiated'
    };

    const initStatus = (result.status || '').toLowerCase();
    const isImmediateSuccess = ['successful', 'completed', 'paid', 'approved', 'concluido', 'success'].includes(initStatus);

    console.log(`Input status: "${initStatus}"`);
    console.log(`Is immediate success? ${isImmediateSuccess}`);

    if (isImmediateSuccess && initStatus === 'success') {
        console.log('❌ REPRODUCED: "success" status during initiation causes immediate approval!');
    } else {
        console.log('✅ FIXED: "success" status no longer causes immediate approval.');
    }
}

testReproduction();

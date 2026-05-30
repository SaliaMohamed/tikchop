
const crypto = require('crypto');

async function testWebhook() {
  const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || 'dummy_secret';
  
  const payload = {
    event: 'charge.success',
    data: {
      reference: 'mock_txn_' + Date.now(),
      status: 'success',
      amount: 500000,
      metadata: {
        order_id: 'dummy-uuid-replace-me'
      },
      customer: {
        phone: '2250102030405'
      }
    }
  };

  const rawBody = JSON.stringify(payload);
  const hash = crypto.createHmac('sha512', PAYSTACK_SECRET).update(rawBody).digest('hex');

  console.log('Sending mock Paystack webhook to localhost:3000...');
  
  try {
    const res = await fetch('http://localhost:3000/api/webhooks/paystack', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-paystack-signature': hash
      },
      body: rawBody
    });
    
    const responseData = await res.json();
    console.log('Response Status:', res.status);
    console.log('Response Body:', responseData);
  } catch (err) {
    console.error('Error hitting webhook endpoint:', err.message);
  }
}

testWebhook();

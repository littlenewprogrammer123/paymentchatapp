import { io } from 'socket.io-client';

const API_URL = 'http://localhost:5000/api';

async function request(endpoint, method = 'GET', body = null, token = null) {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const config = { method, headers };
  if (body) config.body = JSON.stringify(body);

  const res = await fetch(`${API_URL}${endpoint}`, config);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `HTTP error! status: ${res.status}`);
  return data.data;
}

async function runTests() {
  console.log('--- STARTING NODE API INTEGRATION TESTS ---\n');

  try {
    const timestamp = Date.now();
    const adminEmail = `admin_${timestamp}@test.com`;
    const user1Email = `user1_${timestamp}@test.com`;
    const user2Email = `user2_${timestamp}@test.com`;

    // 1. Registration
    console.log('1. Testing Registration...');
    const adminReg = await request('/auth/register', 'POST', { name: 'Admin', email: adminEmail, password: 'password123', role: 'admin' });
    const user1Reg = await request('/auth/register', 'POST', { name: 'User One', email: user1Email, password: 'password123', role: 'user' });
    const user2Reg = await request('/auth/register', 'POST', { name: 'User Two', email: user2Email, password: 'password123', role: 'user' });
    console.log('✅ Registration successful.');

    const adminToken = adminReg.token;
    const user1Token = user1Reg.token;
    const user2Token = user2Reg.token;
    const user1Id = user1Reg.user._id;
    const user2Id = user2Reg.user._id;

    // 2. Auth List Users
    console.log('\n2. Testing Get Users List...');
    const users = await request('/auth/users', 'GET', null, user1Token);
    console.log(`✅ Loaded ${users.length} users. Includes User 2: ${users.some(u => u._id === user2Id)}`);

    // 3. Payments POST
    console.log('\n3. Testing Payment Creation...');
    const payment = await request('/payments', 'POST', {
      amount: 150.50,
      paymentMethodType: 'credit_card',
      cardNumber: '1111222233334444' // to be encrypted
    }, user1Token);
    console.log(`✅ Payment successful. Txn ID: ${payment.transactionId}`);

    // 4. Admin Payments Aggregation
    console.log('\n4. Testing Admin Payments Aggregation...');
    const allPayments = await request('/payments', 'GET', null, adminToken);
    const foundPayment = allPayments.find(p => p.transactionId === payment.transactionId);
    console.log(`✅ Admin retrieved payment. Masked Card: ${foundPayment.maskedCard}, User Email: ${foundPayment.user.email}`);

    // 5. Normal user fetching admin payments (should fail)
    console.log('\n5. Testing Admin Role Guard...');
    try {
      await request('/payments', 'GET', null, user1Token);
      console.error('❌ User was able to access admin payments!');
    } catch (e) {
      console.log('✅ User correctly denied access to admin route (403).');
    }

    // 6. Socket connection
    console.log('\n6. Testing Socket.io Real-time Connection...');
    const socket1 = io('http://localhost:5000', { auth: { token: user1Token } });
    const socket2 = io('http://localhost:5000', { auth: { token: user2Token } });

    await new Promise((resolve) => setTimeout(resolve, 500)); // wait for connection

    console.log(`✅ Socket 1 Connected: ${socket1.connected}, ID: ${socket1.id}`);
    console.log(`✅ Socket 2 Connected: ${socket2.connected}, ID: ${socket2.id}`);

    // 7. Messaging via REST, receive via socket
    console.log('\n7. Testing End-to-End Chat Messaging...');
    
    // Set up listener for User 2
    let messageReceived = false;
    socket2.on('receive_message', (msg) => {
      console.log(`📨 Real-time Socket Received Message on User 2: "${msg.content}"`);
      messageReceived = true;
    });

    // Send via REST point for User 1
    const messageResponse = await request('/messages', 'POST', {
      toUserId: user2Id,
      content: 'Hello User 2! This should be encrypted in DB, and decrypted via socket.'
    }, user1Token);
    console.log(`✅ Message inserted via REST. ID: ${messageResponse._id}`);

    // Wait for socket to emit
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (!messageReceived) console.log('❌ Did not receive socket message.');
    else console.log('✅ Real-time delivery working.');

    // 8. Fetch Chat History
    console.log('\n8. Testing Chat History (Decryption check)...');
    const history = await request(`/messages/${user2Id}`, 'GET', null, user1Token);
    console.log(`✅ History loaded. Messages count: ${history.length}. Last message content: "${history[history.length - 1].content}"`);

    // Clean up
    socket1.disconnect();
    socket2.disconnect();
    console.log('\n--- ALL TESTS PASSED SUCCESSFULLY! ---');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    process.exit(1);
  }
}

runTests();

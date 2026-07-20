import axios from 'axios';

async function testV1Models() {
  console.log('🧪 Testing GET http://localhost:3000/v1/models...');
  try {
    const res = await axios.get('http://localhost:3000/v1/models');
    console.log('✅ /v1/models SUCCESS!');
    console.log(`📊 Received ${res.data?.data?.length} models.`);
    console.log('Sample model data:', JSON.stringify(res.data.data.slice(0, 3), null, 2));
  } catch (err) {
    console.error('❌ Failed:', err.message);
  }
}

testV1Models();

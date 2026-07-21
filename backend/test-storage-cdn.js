const GATEWAY_KEY = 'AR_4c9b2435_929a80d916261b15c582db6fe3e41e52';

const TARGET_DOMAINS = [
  'https://one.apprentice.cyou/v1',
  'http://localhost:3000/v1'
];

const dummyBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function runStorageCDNTest() {
  console.log('================================================================');
  console.log('📸 STORAGE CDN GATEWAY TEST SUITE (CLOUDINARY & IMAGEKIT)');
  console.log('================================================================\n');

  for (const BASE_URL of TARGET_DOMAINS) {
    console.log(`🌐 Testing Target Base URL: ${BASE_URL}`);
    console.log('----------------------------------------------------------------');

    // 1. Cloudinary Upload
    try {
      console.log('🚀 [Cloudinary Upload] Sending request...');
      const uploadRes = await fetch(`${BASE_URL}/storage/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GATEWAY_KEY}`
        },
        body: JSON.stringify({
          file: dummyBase64,
          file_name: 'test_cloudinary_direct.png',
          auto_rotate: true,
          provider: 'cloudinary'
        })
      });

      const data = await uploadRes.json();
      if (uploadRes.status === 201 && data.success) {
        console.log('✅ [Cloudinary] Upload Successful (201 Created)!');
        console.log('   Provider Terpakai :', data.file.provider);
        console.log('   Direct CDN URL    :', data.file.url);
        console.log('   File ID           :', data.file.id);
      } else {
        console.log(`⚠️ [Cloudinary] HTTP ${uploadRes.status}:`, data);
      }
    } catch (err) {
      console.error('❌ [Cloudinary] Network error:', err.message);
    }

    console.log('');

    // 2. ImageKit Upload
    try {
      console.log('🚀 [ImageKit Upload] Sending request...');
      const uploadRes = await fetch(`${BASE_URL}/storage/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GATEWAY_KEY}`
        },
        body: JSON.stringify({
          file: dummyBase64,
          file_name: 'test_imagekit_direct.png',
          auto_rotate: true,
          provider: 'imagekit'
        })
      });

      const data = await uploadRes.json();
      if (uploadRes.status === 201 && data.success) {
        console.log('✅ [ImageKit] Upload Successful (201 Created)!');
        console.log('   Provider Terpakai :', data.file.provider);
        console.log('   Direct CDN URL    :', data.file.url);
        console.log('   File ID           :', data.file.id);
      } else {
        console.log(`⚠️ [ImageKit] HTTP ${uploadRes.status}:`, data);
      }
    } catch (err) {
      console.error('❌ [ImageKit] Network error:', err.message);
    }

    console.log('');

    // 3. List CDN Files
    try {
      console.log('📋 [List CDN Files] Fetching history...');
      const listRes = await fetch(`${BASE_URL}/storage/list?page=1&limit=3`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${GATEWAY_KEY}` }
      });
      const listData = await listRes.json();
      if (listRes.ok) {
        console.log('✅ [List Files] Total files recorded:', listData.pagination?.total);
        if (listData.items && listData.items.length > 0) {
          console.log('   Latest item URL:', listData.items[0].url);
        }
      }
    } catch (err) {
      console.error('❌ [List Files] Error:', err.message);
    }

    console.log('\n================================================================\n');
  }
}

runStorageCDNTest();

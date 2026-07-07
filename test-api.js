async function test() {
  try {
    const loginRes = await fetch('http://localhost:5000/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'password123'
      })
    });
    
    if (!loginRes.ok) {
        console.log('Login failed', loginRes.status, await loginRes.text());
        return;
    }

    const loginData = await loginRes.json();
    const token = loginData.token;
    
    const docsRes = await fetch('http://localhost:5000/api/documents', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const docsData = await docsRes.json();
    
    if (docsData.length < 2) {
      console.log('Not enough documents to test');
      return;
    }
    
    const id1 = docsData[0]._id;
    const id2 = docsData[1]._id;
    
    console.log(`Comparing ${id1} and ${id2}`);
    
    const compareRes = await fetch('http://localhost:5000/api/documents/compare-metadata', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        document1Id: id1,
        document2Id: id2
      })
    });
    
    if (!compareRes.ok) {
        console.log('Compare failed', compareRes.status, await compareRes.text());
        return;
    }
    const compareData = await compareRes.json();
    console.log('Success:', JSON.stringify(compareData, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();

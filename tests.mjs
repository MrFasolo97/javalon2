import javalon from './index.mjs';
import { sha256 } from 'js-sha256';


// Test signing and verifying data with javalon library
function testSignAndVerify() {
    console.log('Testing javalon sign and verify functionality...');
    
    // Generate a key pair for testing
    const keypair = javalon.keypair();
    console.log('Generated key pair:', {
        pub: keypair.pub.substring(0, 20) + '...',
        priv: keypair.priv.substring(0, 20) + '...'
    });
    
    // Test data to sign
    const testData = {
        message: "Hello, Avalon blockchain!",
        timestamp: Date.now(),
        userId: "test-user-123"
    };
    
    const timestamp = Date.now();
    
    // Sign the data
    const signedData = javalon.signData(keypair.priv, keypair.pub, testData, timestamp);
    console.log('Data signed successfully');
    
    // Verify the signature
    const isValid = javalon.signVerify(signedData);
    console.assert(isValid === true, 'Signature verification should return true');
    
    // Test with tampered data - need to manually verify hash mismatch
    const tamperedData = JSON.parse(JSON.stringify(signedData));
    tamperedData.data.message = "Tampered message";
    
    // The signature will still verify against the old hash, but the hash won't match the new data
    // We need to manually check this
    const expectedHash = sha256(JSON.stringify({
        data: tamperedData.data,
        ts: tamperedData.ts,
        ...(tamperedData.username && { username: tamperedData.username })
    }));
    
    const hashMatches = expectedHash === tamperedData.hash;
    console.assert(hashMatches === false, 'Hash should not match for tampered data');
    
    const isTamperedValid = javalon.signVerify(tamperedData);
    console.assert(isTamperedValid === false, 'Tampered data verification should fail due to hash mismatch logic');
    
    // Test with different timestamp format
    const altTimestamp = Math.floor(Date.now() / 1000);
    const signedDataAlt = javalon.signData(keypair.priv, keypair.pub, testData, altTimestamp);
    const isAltValid = javalon.signVerify(signedDataAlt);
    console.assert(isAltValid === true, 'Alternative timestamp should still be valid');
    
    console.log('All sign and verify tests passed!');
    return true;
}

// Run the test
try {
    const result = testSignAndVerify();
    console.assert(result === true, 'Test should complete successfully');
    console.log('✅ Test completed successfully');
} catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
}

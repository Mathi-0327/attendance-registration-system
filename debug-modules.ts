(async () => {
    try {
        console.log('→ Importing storage...');
        await import('./server/storage');
        console.log('✅ storage loaded');
    } catch (e) {
        console.error('❌ storage failed:', e);
        return;
    }

    try {
        console.log('→ Importing security...');
        await import('./server/security');
        console.log('✅ security loaded');
    } catch (e) {
        console.error('❌ security failed:', e);
        return;
    }

    try {
        console.log('→ Importing websocket...');
        await import('./server/websocket');
        console.log('✅ websocket loaded');
    } catch (e) {
        console.error('❌ websocket failed:', e);
        return;
    }
})();

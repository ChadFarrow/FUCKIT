import fs from 'fs/promises';

async function cleanMinimalPlaylist() {
    try {
        console.log('🧹 Cleaning minimal playlist...');
        
        // Read the file
        const filePath = '/Users/chad-mini/Desktop/saved feeds/doerfel-verse-minimal-remote-items.xml';
        const content = await fs.readFile(filePath, 'utf8');
        
        // Remove blank lines and excessive whitespace
        const cleanedContent = content
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join('\n');
        
        // Write back to the file
        await fs.writeFile(filePath, cleanedContent, 'utf8');
        
        console.log('✅ Cleaned minimal playlist - removed blank lines');
        console.log(`📁 File: ${filePath}`);
        
    } catch (error) {
        console.error('❌ Error cleaning minimal playlist:', error);
    }
}

// Run the script
cleanMinimalPlaylist(); 
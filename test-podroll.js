// Simple test to verify PodRoll parsing is working
async function testPodrollParsing() {
  try {
    // Fetch the RSS feed directly
    const response = await fetch('https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml', {
      headers: {
        'User-Agent': 'DoerfelVerse/1.0 (Music RSS Reader)',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch RSS feed: ${response.status}`);
    }
    
    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    // Check for parsing errors
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      throw new Error('Invalid XML format');
    }
    
    const channel = xmlDoc.querySelector('channel');
    if (!channel) {
      throw new Error('Invalid RSS feed: no channel found');
    }
    
    // Extract PodRoll information  
    const podroll = [];
    
    // Try both namespaced and non-namespaced versions for podroll containers
    const podrollElements1 = Array.from(channel.getElementsByTagName('podcast:podroll'));
    const podrollElements2 = Array.from(channel.getElementsByTagName('podroll'));
    const allPodrollElements = [...podrollElements1, ...podrollElements2];
    
    console.log('Found PodRoll elements:', allPodrollElements.length);
    
    allPodrollElements.forEach((podrollElement, index) => {
      console.log(`PodRoll element ${index + 1}:`);
      
      // Look for podcast:remoteItem children within the podroll
      const remoteItems1 = Array.from(podrollElement.getElementsByTagName('podcast:remoteItem'));
      const remoteItems2 = Array.from(podrollElement.getElementsByTagName('remoteItem'));
      const allRemoteItems = [...remoteItems1, ...remoteItems2];
      
      console.log(`  Found remote items: ${allRemoteItems.length}`);
      
      allRemoteItems.forEach((remoteItem, itemIndex) => {
        const feedUrl = remoteItem.getAttribute('feedUrl');
        const feedGuid = remoteItem.getAttribute('feedGuid');
        const title = remoteItem.getAttribute('title') || remoteItem.textContent?.trim();
        const description = remoteItem.getAttribute('description');
        
        console.log(`    Remote Item ${itemIndex + 1}:`);
        console.log(`      Feed URL: ${feedUrl}`);
        console.log(`      Feed GUID: ${feedGuid}`);
        console.log(`      Title: ${title || 'No title'}`);
        console.log(`      Description: ${description || 'No description'}`);
        
        if (feedUrl) {
          podroll.push({
            url: feedUrl,
            title: title || `Feed ${feedGuid ? feedGuid.substring(0, 8) + '...' : 'Unknown'}`,
            description: description || undefined
          });
        }
      });
    });
    
    console.log('\nParsed PodRoll data:');
    console.log(JSON.stringify(podroll, null, 2));
    
    return podroll;
    
  } catch (error) {
    console.error('Error testing PodRoll parsing:', error);
    return null;
  }
}

// Run the test if in browser environment
if (typeof window !== 'undefined') {
  testPodrollParsing().then(result => {
    console.log('Test completed. Result:', result);
  });
} else {
  // Export for Node.js testing
  module.exports = testPodrollParsing;
}
// Simple test of RSS parsing logic
import fetch from 'node-fetch';

async function testParsing() {
  try {
    console.log('Fetching RSS feed...');
    const response = await fetch('https://www.thisisjdog.com/media/ring-that-bell.xml');
    const xmlText = await response.text();
    
    console.log('XML length:', xmlText.length);
    
    // Use browser DOMParser equivalent
    const { DOMParser } = await import('@xmldom/xmldom');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    const channel = xmlDoc.getElementsByTagName('channel')[0];
    if (!channel) {
      console.log('No channel found');
      return;
    }
    
    const title = channel.getElementsByTagName('title')[0]?.textContent?.trim();
    console.log('Channel title:', title);
    
    // Test different approaches to get iTunes image
    console.log('\n=== Testing iTunes Image Access ===');
    
    // Method 1: getElementsByTagName
    const method1 = channel.getElementsByTagName('itunes:image')[0];
    console.log('Method 1 (getElementsByTagName itunes:image):', method1 ? 'Found' : 'Not found');
    if (method1) {
      console.log('  href:', method1.getAttribute('href'));
    }
    
    // Method 2: querySelector with namespace escape (not available in xmldom)
    console.log('Method 2 (querySelector): Not available in xmldom, skipping');
    
    // Method 3: Look for all elements and filter
    const allElements = Array.from(channel.getElementsByTagName('*'));
    const imageElements = allElements.filter(el => 
      el.tagName === 'itunes:image' || 
      (el.tagName === 'image' && el.getAttribute('href'))
    );
    console.log('Method 3 (filter all elements):', imageElements.length, 'found');
    imageElements.forEach((el, i) => {
      console.log(`  Element ${i}: tagName=${el.tagName}, href=${el.getAttribute('href')}`);
    });
    
    // Final test: Try the same logic as our RSS parser
    let coverArt = null;
    
    let imageElement = channel.getElementsByTagName('itunes:image')[0];
    // Skip querySelector fallback since it's not available in xmldom
    
    if (imageElement) {
      coverArt = imageElement.getAttribute('href');
    }
    
    console.log('\n=== Final Result ===');
    console.log('Cover art URL:', coverArt || 'NOT FOUND');
    
    if (coverArt) {
      // Test if the image URL is accessible
      try {
        const imageResponse = await fetch(coverArt, { method: 'HEAD' });
        console.log('Image accessibility:', imageResponse.ok ? 'OK' : 'Failed');
        console.log('Image content-type:', imageResponse.headers.get('content-type'));
      } catch (imgErr) {
        console.log('Image accessibility: Error -', imgErr.message);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testParsing();
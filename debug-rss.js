// Simple script to debug RSS parsing
const fetch = require('node-fetch');
const { DOMParser } = require('xmldom');

async function debugRSS() {
  try {
    console.log('Fetching RSS feed...');
    const response = await fetch('https://www.thisisjdog.com/media/ring-that-bell.xml');
    const xmlText = await response.text();
    
    console.log('XML length:', xmlText.length);
    console.log('First 1000 characters of XML:');
    console.log(xmlText.substring(0, 1000));
    
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    const channel = xmlDoc.querySelector('channel');
    if (channel) {
      const title = channel.querySelector('title')?.textContent?.trim();
      console.log('Channel title:', title);
      
      // Look for images
      console.log('Looking for iTunes image...');
      const itunesImage = channel.querySelector('itunes\\:image') || 
                         channel.getElementsByTagName('itunes:image')[0];
      if (itunesImage) {
        console.log('Found iTunes image element:', itunesImage.outerHTML);
        console.log('href attribute:', itunesImage.getAttribute('href'));
      } else {
        console.log('No iTunes image found');
      }
      
      console.log('Looking for regular image...');
      const imageElement = channel.querySelector('image');
      if (imageElement) {
        console.log('Found image element:', imageElement.outerHTML);
        const urlElement = imageElement.querySelector('url');
        if (urlElement) {
          console.log('Image URL:', urlElement.textContent);
        }
      } else {
        console.log('No regular image found');
      }
      
      console.log('All image-related elements:');
      const allElements = Array.from(channel.getElementsByTagName('*'));
      allElements.forEach(el => {
        if (el.tagName.toLowerCase().includes('image') || 
            el.getAttribute('href')?.includes('.jpg') ||
            el.getAttribute('href')?.includes('.png') ||
            el.textContent?.includes('.jpg') ||
            el.textContent?.includes('.png')) {
          console.log(`- ${el.tagName}: ${el.outerHTML.substring(0, 200)}`);
        }
      });
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

debugRSS();
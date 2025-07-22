

export interface DominantColors {
  primary: string;
  secondary: string;
  tertiary: string;
}

export const extractDominantColors = async (imageUrl: string): Promise<DominantColors | null> => {
  try {
    // Create a new image element
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    // Wait for the image to load
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = imageUrl;
    });

    // Create a canvas to get image data
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Manual color extraction - sample pixels and find dominant colors
    const colorCounts: { [key: string]: number } = {};
    const sampleStep = 5; // Sample every 5th pixel for performance
    
    for (let i = 0; i < data.length; i += sampleStep * 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      
      // Skip transparent or very dark pixels
      if (a < 128 || (r + g + b) < 50) continue;
      
      // Round colors to reduce noise and group similar colors
      const roundedR = Math.round(r / 20) * 20;
      const roundedG = Math.round(g / 20) * 20;
      const roundedB = Math.round(b / 20) * 20;
      
      const colorKey = `${roundedR},${roundedG},${roundedB}`;
      colorCounts[colorKey] = (colorCounts[colorKey] || 0) + 1;
    }
    
    // Sort colors by frequency and filter for vibrant colors
    const sortedColors = Object.entries(colorCounts)
      .sort(([,a], [,b]) => b - a)
      .map(([colorKey, count]) => {
        const [r, g, b] = colorKey.split(',').map(Number);
        const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        const saturation = Math.max(r, g, b) - Math.min(r, g, b);
        const brightness = (r + g + b) / 3;
        
        return {
          hex,
          rgb: [r, g, b],
          count,
          saturation,
          brightness
        };
      })
      .filter(color => 
        color.brightness > 40 && // Not too dark
        color.saturation > 30    // Has good color saturation
      )
      .slice(0, 10); // Get top 10 vibrant colors

    console.log('🎨 Total colors found:', Object.keys(colorCounts).length);
    console.log('🎨 Filtered vibrant colors:', sortedColors.length);
    console.log('🎨 Top colors:', sortedColors.slice(0, 5).map(c => `${c.hex} (brightness: ${c.brightness.toFixed(0)}, saturation: ${c.saturation})`));
    
    
    if (sortedColors.length >= 3) {
      return {
        primary: sortedColors[0].hex,
        secondary: sortedColors[1].hex,
        tertiary: sortedColors[2].hex
      };
    } else {
      console.log('🎨 No vibrant colors found, using fallback colors');
      // Fallback to manual color selection based on the Bloodshot Lies artwork
      return {
        primary: '#ff6b9d',   // Vibrant pink
        secondary: '#ff8c42', // Orange
        tertiary: '#9d4edd'   // Purple
      };
    }
  } catch (error) {
    console.error('Error extracting colors:', error);
    console.log('🎨 Using fallback colors due to error');
    // Fallback colors for Bloodshot Lies
    return {
      primary: '#ff6b9d',   // Vibrant pink
      secondary: '#ff8c42', // Orange  
      tertiary: '#9d4edd'   // Purple
    };
  }
};

// Helper function to get contrasting text color (black or white)
export const getContrastColor = (hexColor: string): string => {
  // Convert hex to RGB
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return black for light backgrounds, white for dark backgrounds
  return luminance > 0.5 ? '#000000' : '#ffffff';
};

// Helper function to get a lighter/darker variant of a color
export const adjustColorBrightness = (hexColor: string, percent: number): string => {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  
  const factor = 1 + (percent / 100);
  
  const newR = Math.min(255, Math.max(0, Math.round(r * factor)));
  const newG = Math.min(255, Math.max(0, Math.round(g * factor)));
  const newB = Math.min(255, Math.max(0, Math.round(b * factor)));
  
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}; 
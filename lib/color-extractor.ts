import ColorThief from 'colorthief';

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
    
    // Use ColorThief to get the palette with better sampling
    const colorThief = new ColorThief();
    const palette = colorThief.getPalette(img, 5); // Get more colors for better selection
    
    // Convert RGB arrays to hex strings and filter for vibrant colors
    const colors = palette.map(rgb => {
      const [r, g, b] = rgb;
      return {
        hex: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`,
        rgb: [r, g, b],
        saturation: Math.max(r, g, b) - Math.min(r, g, b), // Calculate saturation
        brightness: (r + g + b) / 3 // Calculate brightness
      };
    });

    // Filter out very dark colors and prioritize vibrant ones
    const vibrantColors = colors.filter(color => 
      color.brightness > 30 && // Not too dark
      color.saturation > 20    // Has some color saturation
    );

    // If we have vibrant colors, use them; otherwise use the original palette
    const selectedColors = vibrantColors.length >= 3 ? vibrantColors : colors;

    return {
      primary: selectedColors[0]?.hex || colors[0].hex,
      secondary: selectedColors[1]?.hex || colors[1].hex,
      tertiary: selectedColors[2]?.hex || colors[2].hex
    };
  } catch (error) {
    console.error('Error extracting colors:', error);
    return null;
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
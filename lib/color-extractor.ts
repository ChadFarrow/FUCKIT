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
    
    // Use ColorThief to get the palette
    const colorThief = new ColorThief();
    const palette = colorThief.getPalette(img, 3);
    
    // Convert RGB arrays to hex strings
    const colors = palette.map(rgb => {
      const [r, g, b] = rgb;
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    });

    return {
      primary: colors[0],
      secondary: colors[1],
      tertiary: colors[2]
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
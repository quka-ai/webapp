export type CompressResult = {
    success: boolean;
    file: File | null;
    error?: string;
};

const MAX_SIZE_MB = 3;
const MAX_WIDTH = 650; // 限制宽度
const MAX_HEIGHT = 366; // 限制高度
const QUALITY = 0.7; // 默认压缩质量

export const compressImage = async (file: File, quality: number = QUALITY, maxSize: number = MAX_SIZE_MB): Promise<CompressResult> => {
    if (!file.type.startsWith('image/')) {
        return { success: false, file: null, error: 'Provided file is not an image' };
    }

    const sizeMB = file.size / (1024 * 1024);

    if (sizeMB <= maxSize) {
        return { success: true, file }; // 不需要压缩
    }

    try {
        const image = await loadImage(file);

        const { width, height } = calculateDimensions(image, MAX_WIDTH, MAX_HEIGHT);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (!context) {
            return { success: false, file: null, error: 'Failed to create canvas context' };
        }

        canvas.width = width;
        canvas.height = height;

        context.drawImage(image, 0, 0, width, height);

        const compressedBlob = await new Promise<Blob | null>(resolve => {
            canvas.toBlob(blob => resolve(blob), file.type, quality);
        });

        if (!compressedBlob) {
            return { success: false, file: null, error: 'Failed to compress image' };
        }

        const compressedFile = new File([compressedBlob], file.name, {
            type: file.type
        });

        return compressImage(compressedFile, quality);
    } catch (error) {
        return { success: false, file: null, error: (error as Error).message };
    }
};

const loadImage = (file: File): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            const image = new Image();

            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('Failed to load image'));
            image.src = reader.result as string;
        };

        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
};

const calculateDimensions = (image: HTMLImageElement, maxWidth: number, maxHeight: number): { width: number; height: number } => {
    let { width, height } = image;

    if (width > maxWidth || height > maxHeight) {
        const aspectRatio = width / height;

        if (aspectRatio > 1) {
            // Landscape
            width = maxWidth;
            height = maxWidth / aspectRatio;
        } else {
            // Portrait
            height = maxHeight;
            width = maxHeight * aspectRatio;
        }
    }

    return { width: Math.round(width), height: Math.round(height) };
};

// export default function App() {
//   const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
//     const file = event.target.files?.[0];
//     if (!file) return;

//     const result = await compressImage(file);

//     if (result.success && result.file) {
//       console.log("Compressed file:", result.file);
//     } else {
//       console.error("Error compressing file:", result.error);
//     }
//   };

//   return (
//     <div>
//       <h1>Image Compression</h1>
//       <input type="file" accept="image/*" onChange={handleFileChange} />
//     </div>
//   );
// }

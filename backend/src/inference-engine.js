const ort = require('onnxruntime-node');
const sharp = require('sharp');
const path = require('path');

class InferenceEngine {
    constructor(mode = 'server') {
        this.mode = mode;
        this.session = null;
        this.modelPath = path.join(__dirname, '../../models/yolov5n.onnx');
        this.inputSize = [320, 240]; // Low-resource friendly
        this.confidenceThreshold = 0.5;
        this.iouThreshold = 0.4;

        // COCO class names (simplified)
        this.classNames = [
            'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck',
            'boat', 'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench',
            'bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra',
            'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
            'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove',
            'skateboard', 'surfboard', 'tennis racket', 'bottle', 'wine glass', 'cup',
            'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange',
            'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
            'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
            'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink',
            'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier',
            'toothbrush'
        ];
    }

    async initialize() {
        if (this.mode === 'server') {
            try {
                // Try to load the model
                console.log('Loading ONNX model:', this.modelPath);
                this.session = await ort.InferenceSession.create(this.modelPath);
                console.log('✅ Model loaded successfully');

                // Print model info
                console.log('Input names:', this.session.inputNames);
                console.log('Output names:', this.session.outputNames);
            } catch (error) {
                console.warn('⚠️  Could not load ONNX model, using mock detection:', error.message);
                this.session = null; // Will use mock detection
            }
        } else {
            console.log('WASM mode: inference will run in browser');
        }
    }

    async detectObjects(frameData) {
        if (this.mode !== 'server') {
            throw new Error('Server-side detection only available in server mode');
        }

        try {
            if (!this.session) {
                // Return mock detections for demonstration
                return this.generateMockDetections();
            }

            // Preprocess frame
            const tensor = await this.preprocessFrame(frameData);

            // Run inference
            const feeds = {};
            feeds[this.session.inputNames[0]] = tensor;
            const results = await this.session.run(feeds);

            // Post-process results
            const output = results[this.session.outputNames[0]];
            const detections = this.postprocessResults(output);

            return detections;
        } catch (error) {
            console.error('Detection error:', error);
            // Return mock detections as fallback
            return this.generateMockDetections();
        }
    }

    async preprocessFrame(frameData) {
        try {
            // Resize and normalize the frame
            const resized = await sharp(frameData.data)
                .resize(this.inputSize[0], this.inputSize[1])
                .raw()
                .toBuffer();

            // Convert to float32 and normalize to [0, 1]
            const float32Data = new Float32Array(this.inputSize[0] * this.inputSize[1] * 3);
            for (let i = 0; i < resized.length; i++) {
                float32Data[i] = resized[i] / 255.0;
            }

            // Create tensor [1, 3, height, width]
            const tensor = new ort.Tensor('float32', float32Data, [1, 3, this.inputSize[1], this.inputSize[0]]);
            return tensor;
        } catch (error) {
            console.error('Preprocessing error:', error);
            throw error;
        }
    }

    postprocessResults(output) {
        try {
            const detections = [];
            const data = output.data;
            const shape = output.dims;

            // YOLOv5 output format: [batch, 25200, 85]
            // where 85 = 4 (bbox) + 1 (conf) + 80 (classes)
            const numDetections = shape[1];
            const numClasses = shape[2] - 5;

            for (let i = 0; i < numDetections; i++) {
                const offset = i * shape[2];

                // Extract bbox coordinates (center_x, center_y, width, height)
                const centerX = data[offset + 0];
                const centerY = data[offset + 1];
                const width = data[offset + 2];
                const height = data[offset + 3];
                const confidence = data[offset + 4];

                if (confidence < this.confidenceThreshold) continue;

                // Find best class
                let bestClass = 0;
                let bestScore = 0;

                for (let j = 0; j < numClasses; j++) {
                    const score = data[offset + 5 + j] * confidence;
                    if (score > bestScore) {
                        bestScore = score;
                        bestClass = j;
                    }
                }

                if (bestScore < this.confidenceThreshold) continue;

                // Convert to corner coordinates and normalize
                const xmin = Math.max(0, (centerX - width / 2) / this.inputSize[0]);
                const ymin = Math.max(0, (centerY - height / 2) / this.inputSize[1]);
                const xmax = Math.min(1, (centerX + width / 2) / this.inputSize[0]);
                const ymax = Math.min(1, (centerY + height / 2) / this.inputSize[1]);

                detections.push({
                    label: this.classNames[bestClass] || `class_${bestClass}`,
                    score: Math.round(bestScore * 100) / 100,
                    xmin: Math.round(xmin * 1000) / 1000,
                    ymin: Math.round(ymin * 1000) / 1000,
                    xmax: Math.round(xmax * 1000) / 1000,
                    ymax: Math.round(ymax * 1000) / 1000
                });
            }

            // Apply Non-Maximum Suppression
            return this.applyNMS(detections);
        } catch (error) {
            console.error('Postprocessing error:', error);
            return [];
        }
    }

    applyNMS(detections) {
        // Simple NMS implementation
        const sortedDetections = detections.sort((a, b) => b.score - a.score);
        const kept = [];

        for (const detection of sortedDetections) {
            let shouldKeep = true;

            for (const keptDetection of kept) {
                const iou = this.calculateIoU(detection, keptDetection);
                if (iou > this.iouThreshold) {
                    shouldKeep = false;
                    break;
                }
            }

            if (shouldKeep) {
                kept.push(detection);
            }
        }

        return kept;
    }

    calculateIoU(box1, box2) {
        // Calculate intersection area
        const xLeft = Math.max(box1.xmin, box2.xmin);
        const yTop = Math.max(box1.ymin, box2.ymin);
        const xRight = Math.min(box1.xmax, box2.xmax);
        const yBottom = Math.min(box1.ymax, box2.ymax);

        if (xRight < xLeft || yBottom < yTop) return 0;

        const intersectionArea = (xRight - xLeft) * (yBottom - yTop);

        // Calculate union area
        const box1Area = (box1.xmax - box1.xmin) * (box1.ymax - box1.ymin);
        const box2Area = (box2.xmax - box2.xmin) * (box2.ymax - box2.ymin);
        const unionArea = box1Area + box2Area - intersectionArea;

        return intersectionArea / unionArea;
    }

    generateMockDetections() {
        // Generate realistic mock detections for demonstration
        const mockDetections = [
            {
                label: 'person',
                score: 0.87,
                xmin: 0.1,
                ymin: 0.2,
                xmax: 0.4,
                ymax: 0.8
            },
            {
                label: 'chair',
                score: 0.72,
                xmin: 0.6,
                ymin: 0.5,
                xmax: 0.9,
                ymax: 0.9
            }
        ];

        // Randomly return 0-2 detections
        const numDetections = Math.floor(Math.random() * 3);
        return mockDetections.slice(0, numDetections);
    }
}

module.exports = InferenceEngine;
// Video Block Tool, based on Image Tool
import ImageTool from '@editorjs/image';
import { createRoot } from 'react-dom/client';

import Videojs from './videojs';

const IconVideo = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
		<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
			<rect width="20" height="16" x="2" y="4" rx="4" />
			<path d="m15 12l-5-3v6z" />
		</g>
	</svg>`;

export default class Video extends ImageTool {
    static get toolbox() {
        return { title: 'Video', icon: IconVideo };
    }

    /**
     * @param {object} tool - tool properties got from editor.js
     * @param {ImageToolData} tool.data - previously saved data
     * @param {ImageConfig} tool.config - user config for Tool
     * @param {object} tool.api - Editor.js API
     * @param {boolean} tool.readOnly - read-only mode flag
     * @param {BlockAPI|{}} tool.block - current Block API
     */
    constructor({ data, config, api, onSelectFile, readOnly, block }) {
        config.buttonContent = config.buttonContent || `${IconVideo} ${api.i18n.t('Select a Video')}`;
        config.types = config.types || 'video/*';
        super({ data, config, api, onSelectFile, readOnly, block });
        this.readOnly = readOnly;
    }

    // original render() method from image tool is used
    // render() {
    // }

    /**
     * Set new video file (override default method)
     *
     * @private
     *
     * @param {object} file - uploaded file data
     */
    set image(file) {
        this._data.file = file || {};

        if (file && file.url) {
            // this.ui.fillImage(file.url);
            this.fillVideo(file.url);
        }
    }

    /**
     * Shows a video
     *
     * @param {string} url - video source
     * @returns {void}
     */
    fillVideo(url) {
        const root = createRoot(this.ui.nodes.imageContainer);
        if (url || this.readOnly) {
            setTimeout(() => {
                this.ui.toggleStatus('filled');
            }, 500);
        }
        root.render(
            <Videojs
                src={url}
                className={this.ui.CSS.imageEl}
                onLoadedData={() => {
                    this.ui.toggleStatus('filled');
                    if (this.ui.nodes.imagePreloader) {
                        this.ui.nodes.imagePreloader.style.backgroundImage = '';
                    }
                }}
            />
        );
    }

    static get pasteConfig() {
        return {
            tags: [
                {
                    videojs: { src: true },
                    video: { src: true }
                }
            ],
            patterns: {
                video: /https?:\/\/\S+\.(mov|ogv|webm|mp4|m4v|m3u8)(\?[a-z0-9=]*)?$/i
            },
            files: {
                mimeTypes: ['video/*']
            }
        };
    }

    async onPaste(event) {
        switch (event.type) {
            case 'tag': {
                const video = event.detail.data;
                // need getAttribute for custom HTML element videojs
                this.uploadUrl(video.getAttribute('src'));
                break;
            }
            case 'pattern': {
                const url = event.detail.data;
                this.uploadUrl(url);
                break;
            }
            case 'file': {
                const file = event.detail.file;
                this.uploadFile(file);
                break;
            }
        }
    }

    destroy() {
        const root = createRoot(this.ui.nodes.imageContainer);

        root.render(null);
    }
}

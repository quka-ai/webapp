import { useEffect, useRef } from 'react';

// import videojs from 'video.js';

export interface VideoProps {
    src: string;
    poster: string;
    onLoadedData: () => void;
}

export default function VideoComponent(props: VideoProps) {
    // const options = {
    //     fluid: true,
    //     poster: props.poster,
    //     playbackRates: [0.5, 0.75, 1, 1.25, 1.5]
    // };

    const videoEl = useRef<HTMLElement>();

    useEffect(() => {
        videoEl.current.addEventListener('loadeddata', e => {
            props.onLoadedData(e);
        });
        // player.on('ended', function () {
        //     if (player.isFullscreen()) {
        //         player.exitFullscreen();
        //     }
        // });

        return () => {
            player.dispose();
        };
    }, [props.src]);

    return (
        <>
            {props.src && (
                <video ref={videoEl} controls className="video-js" preload="auto" crossOrigin="anonymous">
                    <source src={props.src + '#t=0.1'} />
                </video>
            )}
        </>
    );
}

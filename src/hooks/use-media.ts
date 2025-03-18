import { useMediaQuery } from 'usehooks-ts';

export const useMedia = () => {
    const isMobile = useMediaQuery('(max-width: 768px)');

    return { isMobile };
};

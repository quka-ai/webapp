import { SVGProps } from 'react';

export type IconSvgProps = SVGProps<SVGSVGElement> & {
    size?: number;
};

export enum Role {
    ADMIN = 'role-admin',
    EDITOR = 'role-editor',
    VIEWER = 'role-viewer',
    MEMBER = 'role-member'
}

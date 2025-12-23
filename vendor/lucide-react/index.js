import React from 'react';

const defaultSvgProps = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: 24,
  height: 24,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
};

const createIcon = (nodes) =>
  React.forwardRef((props, ref) => (
    <svg {...defaultSvgProps} {...props} ref={ref}>
      {nodes.map((node, index) => React.createElement(node.tag ?? 'path', { key: index, ...node.props }))}
    </svg>
  ));

export const Eye = createIcon([
  { props: { d: 'M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z' } },
  { tag: 'circle', props: { cx: 12, cy: 12, r: 3 } },
]);

export const EyeOff = createIcon([
  { props: { d: 'M3 3 21 21' } },
  { props: { d: 'M10.7 10.7a3 3 0 1 0 4.6 4.6' } },
  { props: { d: 'M9.53 5.11A10.46 10.46 0 0 1 12 5c7 0 11 7 11 7a16.48 16.48 0 0 1-2.06 2.88' } },
  { props: { d: 'M6.61 6.61C3.93 8.28 2 12 2 12a16.54 16.54 0 0 0 5.11 5.11' } },
]);

export const Download = createIcon([
  { props: { d: 'M12 3V15M12 15L7 10M12 15L17 10M5 21H19' } },
]);

export const Upload = createIcon([
  { props: { d: 'M12 21V9' } },
  { props: { d: 'm8 13 4-4 4 4' } },
  { props: { d: 'M4 3h16v4H4z' } },
]);

export const Trash2 = createIcon([
  { props: { d: 'M3 6H21' } },
  { props: { d: 'M9 6V4H15V6' } },
  { props: { d: 'M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z' } },
]);

export const Settings = createIcon([
  { tag: 'circle', props: { cx: 12, cy: 12, r: 3 } },
  {
    props: {
      d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1 1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .69.4 1.31 1.01 1.58.63.28 1.37.13 1.87-.37',
    },
  },
]);

export const Lock = createIcon([
  { tag: 'rect', props: { x: 3, y: 11, width: 18, height: 11, rx: 2 } },
  { props: { d: 'M7 11V7a5 5 0 0 1 10 0v4' } },
]);

export const Copy = createIcon([
  { tag: 'rect', props: { x: 9, y: 9, width: 13, height: 13, rx: 2 } },
  { props: { d: 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' } },
]);

export const Paperclip = createIcon([
  {
    props: {
      d: 'M21.44 11.05L12.7 19.79C10.35 22.14 6.54 22.14 4.19 19.79C1.84 17.44 1.84 13.63 4.19 11.28L12.93 2.54C14.5 0.97 17.04 0.97 18.61 2.54C20.18 4.11 20.18 6.65 18.61 8.22L10.24 16.59C9.45 17.38 8.17 17.38 7.38 16.59C6.59 15.8 6.59 14.52 7.38 13.73L15.04 6.07',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    },
  },
]);

export const RefreshCw = createIcon([
  { props: { d: 'M21 2v6h-6' } },
  { props: { d: 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.36 2.36' } },
  { props: { d: 'M3 22v-6h6' } },
  { props: { d: 'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.36-2.36' } },
]);

export default {
  Eye,
  EyeOff,
  Download,
  Upload,
  Trash2,
  Settings,
  Lock,
  Copy,
  Paperclip,
  RefreshCw,
};

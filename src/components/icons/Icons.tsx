interface IconProps {
  className?: string;
  size?: number;
  strokeWidth?: number;
}

const d = (paths: string | string[], viewBox = '0 0 24 24') => {
  const Icon = ({ className = '', size = 24, strokeWidth = 1.8 }: IconProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {(Array.isArray(paths) ? paths : [paths]).map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  );
  return Icon;
};

export const HomeIcon = d([
  'M3 9.5L12 3l9 6.5',
  'M5 10v9a1 1 0 001 1h12a1 1 0 001-1v-9',
]);

export const CalendarIcon = d([
  'M4 6a2 2 0 012-2h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6z',
  'M2 8h20',
  'M8 2v4',
  'M16 2v4',
]);

export const CameraIcon = d([
  'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z',
  'M12 17a4 4 0 100-8 4 4 0 000 8z',
]);

export const PlusIcon = d(['M12 5v14M5 12h14']);

export const ChevronLeftIcon = d(['M15 18l-6-6 6-6']);

export const TrashIcon = d([
  'M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6',
  'M10 11v6M14 11v6',
]);

export const EditIcon = d([
  'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7',
  'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
]);

export const CheckIcon = d(['M20 6L9 17l-5-5']);

export const ClockIcon = d([
  'M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z',
  'M12 6V12L16 14',
]);

export const MapPinIcon = d([
  'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z',
  'M12 13a3 3 0 100-6 3 3 0 000 6z',
]);

export const PhoneIcon = d([
  'M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z',
]);

export const MailIcon = d([
  'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z',
  'M22 6l-10 7L2 6',
]);

export const DollarIcon = d([
  'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
]);

export const TrendingUpIcon = d([
  'M23 6l-9.5 9.5-5-5L1 18',
  'M17 6h6v6',
]);

export const SearchIcon = d([
  'M11 19a8 8 0 100-16 8 8 0 000 16z',
  'M21 21l-4.35-4.35',
]);

export const ImageIcon = d([
  'M21 3H3a2 2 0 00-2 2v14a2 2 0 002 2h18a2 2 0 002-2V5a2 2 0 00-2-2z',
  'M8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
  'M21 15l-5-5L5 21',
]);

export const SparklesIcon = d([
  'M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z',
  'M18 14l.75 2.25L21 17l-2.25.75L18 20l-.75-2.25L15 17l2.25-.75L18 14z',
  'M5 17l.5 1.5L7 19l-1.5.5L5 21l-.5-1.5L3 19l1.5-.5L5 17z',
]);

export const HeadphonesIcon = d([
  'M3 18v-6a9 9 0 0118 0v6',
  'M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z',
]);

export const XIcon = d(['M18 6L6 18M6 6l12 12']);

export const LogOutIcon = d([
  'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
]);

export const FileTextIcon = d([
  'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z',
  'M14 2v6h6M16 13H8M16 17H8M10 9H8',
]);

export const CarIcon = d([
  'M5 17h14M5 17a2 2 0 01-2-2V9a2 2 0 012-2h1l2-3h8l2 3h1a2 2 0 012 2v6a2 2 0 01-2 2M5 17a2 2 0 100 4 2 2 0 000-4zM19 17a2 2 0 100 4 2 2 0 000-4z',
]);

export const ClipboardCheckIcon = d([
  'M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2',
  'M15 2H9a1 1 0 00-1 1v2a1 1 0 001 1h6a1 1 0 001-1V3a1 1 0 00-1-1z',
  'M9 14l2 2 4-4',
]);

export const AlertCircleIcon = d([
  'M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z',
  'M12 8V12M12 16H12.01',
]);

export const UploadIcon = d([
  'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12',
]);

export const RefreshIcon = d([
  'M1 4v6h6M23 20v-6h-6',
  'M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15',
]);

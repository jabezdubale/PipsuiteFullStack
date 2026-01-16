
/**
 * Formats a Date object or ISO string into the format required by datetime-local inputs:
 * YYYY-MM-DDTHH:mm
 * This uses the browser's local timezone.
 */
export const toLocalInputString = (dateSource: string | Date | undefined): string => {
    if (!dateSource) return '';
    const date = typeof dateSource === 'string' ? new Date(dateSource) : dateSource;
    if (isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Generates a YYYY-MM-DD string key for Calendar grouping based on Local Time.
 * This prevents the "UTC Midnight Shift" where trades show up on the wrong day.
 */
export const getCalendarDateKey = (dateSource: string | Date): string => {
    const date = typeof dateSource === 'string' ? new Date(dateSource) : dateSource;
    if (isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    return `${year}-${month}-${day}`;
};

/**
 * Standardized display format for the UI
 * e.g., "Oct 25, 2023, 2:30 PM UTC-4"
 */
export const formatDisplayDate = (isoString: string | undefined): string => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '-';

    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    
    let hours = date.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    const h = hours.toString().padStart(2, '0');
    
    const min = date.getMinutes().toString().padStart(2, '0');
    const s = date.getSeconds().toString().padStart(2, '0');

    const offsetMinutes = date.getTimezoneOffset();
    const offsetHours = Math.abs(Math.floor(offsetMinutes / 60));
    const offsetMinsRemainder = Math.abs(offsetMinutes % 60);
    const sign = offsetMinutes > 0 ? '-' : '+'; // JS Offset is inverted

    let offsetString = `UTC${sign}${offsetHours}`;
    if (offsetMinsRemainder > 0) {
      offsetString += `:${offsetMinsRemainder.toString().padStart(2, '0')}`;
    }
    
    return `${d}/${m}/${y}, ${h}:${min}:${s} ${ampm} ${offsetString}`;
};

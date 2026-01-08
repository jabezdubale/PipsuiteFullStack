
import { Session } from '../types';

export const getSessionForTime = (date: Date): string => {
  const getHourInZone = (date: Date, timeZone: string) => {
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hour: 'numeric',
            hour12: false
        });
        const hourStr = formatter.format(date);
        // "24" might be returned for midnight in some implementations, but usually 0-23
        return parseInt(hourStr, 10);
    } catch (e) {
        return -1;
    }
  };

  const nyHour = getHourInZone(date, 'America/New_York');
  const londonHour = getHourInZone(date, 'Europe/London');
  const tokyoHour = getHourInZone(date, 'Asia/Tokyo');
  const sydneyHour = getHourInZone(date, 'Australia/Sydney');

  const activeSessions: string[] = [];

  // Order: Sydney -> Tokyo -> London -> New York

  // Sydney: 07:00 - 16:00
  if (sydneyHour >= 7 && sydneyHour < 16) activeSessions.push(Session.SYDNEY);
  
  // Tokyo: 09:00 - 18:00
  if (tokyoHour >= 9 && tokyoHour < 18) activeSessions.push(Session.TOKYO);

  // London: 08:00 - 17:00
  if (londonHour >= 8 && londonHour < 17) activeSessions.push(Session.LONDON);

  // New York: 08:00 - 17:00
  if (nyHour >= 8 && nyHour < 17) activeSessions.push(Session.NEW_YORK);

  if (activeSessions.length === 0) return Session.NONE;
  
  return activeSessions.join(', ');
};

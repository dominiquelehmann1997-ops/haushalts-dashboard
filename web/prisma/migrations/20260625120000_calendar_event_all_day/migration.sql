-- Ganztägiger Termin (Google `start.date` statt `dateTime`)
ALTER TABLE "CalendarEvent" ADD COLUMN "allDay" BOOLEAN NOT NULL DEFAULT false;

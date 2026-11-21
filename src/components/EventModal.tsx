import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Link2, FileText, Building, MapPin } from 'lucide-react';
import type { Event } from '../types';
import { easternWallClockToUtc, formatDateInputEastern, formatTimeInputEastern } from '../utils/eventTime';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: Omit<Event, 'id'>) => void;
  onDelete?: () => void;
  initialData?: Event | null;
  selectedDate?: Date | null;
}

export function EventModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialData,
  selectedDate,
}: EventModalProps) {
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [isAllDay, setIsAllDay] = useState(false);
  const [hostOrganization, setHostOrganization] = useState('');
  const [location, setLocation] = useState('');
  const [link, setLink] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setStartDate(formatDateInputEastern(initialData.startDate));
      setStartTime(formatTimeInputEastern(initialData.startDate));
      setEndTime(formatTimeInputEastern(initialData.endDate));
      setIsAllDay(initialData.isAllDay);
      setHostOrganization(initialData.hostOrganization || '');
      setLocation(initialData.location || '');
      setLink(initialData.link || '');
      setNotes(initialData.notes || '');
    } else {
      setTitle('');
      setStartDate(
        selectedDate ? formatDateInputEastern(selectedDate) : formatDateInputEastern(new Date()),
      );
      setStartTime('09:00');
      setEndTime('10:00');
      setIsAllDay(false);
      setHostOrganization('');
      setLocation('');
      setLink('');
      setNotes('');
    }
  }, [initialData, selectedDate, isOpen]);

  const handleSave = () => {
    let startDateTime: Date;
    let endDateTime: Date;
    if (isAllDay) {
      startDateTime = easternWallClockToUtc(startDate, '00:00');
      endDateTime = easternWallClockToUtc(startDate, '23:59');
    } else {
      startDateTime = easternWallClockToUtc(startDate, startTime);
      endDateTime = easternWallClockToUtc(startDate, endTime);
    }

    const eventData: Omit<Event, 'id'> = {
      title: title || 'Untitled Event',
      startDate: startDateTime,
      endDate: endDateTime,
      isAllDay,
      hostOrganization: hostOrganization || undefined,
      location: location || undefined,
      link: link || undefined,
      notes: notes || undefined,
    };

    onSave(eventData);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="p-8 pb-0">
          <DialogTitle className="text-2xl">
            {initialData ? 'Edit Event' : 'Submit New Event'}
          </DialogTitle>
          <DialogDescription className="text-lg mt-2">
            {initialData
              ? 'Edit the details of your event'
              : 'Fill in the details to submit a new event for approval'}
          </DialogDescription>
        </DialogHeader>

        <div className="p-8 pt-4 space-y-8">
          <div className="space-y-3">
            <label htmlFor="title" className="block text-lg font-medium">
              Event Title
            </label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter event title..."
              className="text-lg p-4 h-auto"
            />
          </div>

          <div className="space-y-4">
            <label className="block text-lg font-medium">When (US Eastern)</label>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label htmlFor="date" className="block text-base font-medium text-muted-foreground">
                  Date
                </label>
                <Input
                  id="date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-base p-3 h-auto"
                />
              </div>

              {!isAllDay && (
                <>
                  <div className="space-y-2">
                    <label htmlFor="startTime" className="block text-base font-medium text-muted-foreground">
                      Start Time
                    </label>
                    <Input
                      id="startTime"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="text-base p-3 h-auto"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="endTime" className="block text-base font-medium text-muted-foreground">
                      End Time
                    </label>
                    <Input
                      id="endTime"
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="text-base p-3 h-auto"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Switch id="allDay" checked={isAllDay} onCheckedChange={setIsAllDay} />
              <label htmlFor="allDay" className="text-base">
                All day event
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Building className="h-5 w-5 text-green-500" />
              <label htmlFor="hostOrganization" className="text-lg font-medium">
                Host Organization (Optional)
              </label>
            </div>
            <Input
              id="hostOrganization"
              value={hostOrganization}
              onChange={(e) => setHostOrganization(e.target.value)}
              placeholder="Enter organizing company or group..."
              className="text-lg p-4 h-auto"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-green-500" />
              <label htmlFor="location" className="text-lg font-medium">
                Location (Optional)
              </label>
            </div>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Enter venue or address..."
              className="text-lg p-4 h-auto"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-green-500" />
              <label htmlFor="link" className="text-lg font-medium">
                Link (Optional)
              </label>
            </div>
            <Input
              id="link"
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://example.com"
              className="text-lg p-4 h-auto"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-500" />
              <label htmlFor="notes" className="text-lg font-medium">
                Description (Optional)
              </label>
            </div>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add event description or notes..."
              className="text-lg p-4 min-h-[100px] resize-y"
            />
          </div>

          <div className="flex gap-4 pt-4 border-t border-border">
            <Button
              onClick={handleSave}
              className="text-lg px-8 py-3 h-auto hover:bg-primary hover:opacity-90"
            >
              {initialData ? 'Update Event' : 'Submit Event'}
            </Button>
            <Button variant="outline" onClick={onClose} className="text-lg px-8 py-3 h-auto">
              Cancel
            </Button>
            {onDelete && (
              <Button
                variant="destructive"
                onClick={onDelete}
                className="text-lg px-8 py-3 h-auto ml-auto"
              >
                Delete Event
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateCalendarItem, useUpdateCalendarItem } from "../hooks/useCalendarItems";
import { useUsers } from "../hooks/useUsers";
import type { CalendarItemWithRelations, CalendarItemType, ItemStatus } from "../types";
import { ITEM_TYPE_LABELS, STATUS_LABELS } from "../types";

interface EventFormProps {
  event: CalendarItemWithRelations | null;
  isOpen: boolean;
  onClose: () => void;
  defaultDate?: Date;
  defaultType?: CalendarItemType;
}

export function EventForm({ event, isOpen, onClose, defaultDate, defaultType }: EventFormProps) {
  const isEditing = !!event;

  // Form state
  const [type, setType] = useState<CalendarItemType>("MEETING");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [allDay, setAllDay] = useState(false);
  const [status, setStatus] = useState<ItemStatus>("DRAFT");
  const [location, setLocation] = useState("");
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  // Queries
  const { data: users = [] } = useUsers();
  const createItem = useCreateCalendarItem();
  const updateItem = useUpdateCalendarItem();

  // Initialize form when event changes
  useEffect(() => {
    if (event) {
      setType(event.type as CalendarItemType);
      setTitle(event.title);
      setDescription(event.description || "");
      setStartDate(format(new Date(event.startAt), "yyyy-MM-dd"));
      setStartTime(format(new Date(event.startAt), "HH:mm"));
      if (event.endAt) {
        setEndTime(format(new Date(event.endAt), "HH:mm"));
      }
      setAllDay(event.allDay);
      setStatus(event.status as ItemStatus);
      setLocation(event.location || "");
      setSelectedParticipants(event.participants.map((p) => p.user.id));
    } else {
      // Reset form for new event
      setType(defaultType || "MEETING");
      setTitle("");
      setDescription("");
      setStartDate(defaultDate ? format(defaultDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"));
      setStartTime("10:00");
      setEndTime("11:00");
      setAllDay(false);
      setStatus("DRAFT");
      setLocation("");
      setSelectedParticipants([]);
    }
  }, [event, defaultDate, defaultType, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Enter a title");
      return;
    }

    const startAt = new Date(`${startDate}T${allDay ? "00:00" : startTime}:00`);
    const endAt = allDay ? null : new Date(`${startDate}T${endTime}:00`);

    try {
      if (isEditing) {
        await updateItem.mutateAsync({
          id: event.id,
          type,
          title: title.trim(),
          description: description.trim() || null,
          startAt: startAt.toISOString(),
          endAt: endAt?.toISOString() || null,
          allDay,
          status,
          location: location.trim() || null,
          participants: selectedParticipants.map((userId) => ({ userId, role: "PARTICIPANT" as const })),
        });
        toast.success("Event updated");
      } else {
        await createItem.mutateAsync({
          type,
          title: title.trim(),
          description: description.trim() || undefined,
          startAt: startAt.toISOString(),
          endAt: endAt?.toISOString(),
          allDay,
          status,
          location: location.trim() || undefined,
          participants: selectedParticipants.map((userId) => ({ userId, role: "PARTICIPANT" as const })),
        });
        toast.success("Event created");
      }
      onClose();
    } catch (error) {
      console.error("[EventForm] Submit error:", error);
      toast.error(isEditing ? "Error updating" : "Error creating");
    }
  };

  const isPending = createItem.isPending || updateItem.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit event" : "New event"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Type */}
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as CalendarItemType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ITEM_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Event description"
              rows={3}
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>

          {/* All day checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="allDay"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="rounded border-gray-300"
            />
            <Label htmlFor="allDay" className="font-normal">
              All day
            </Label>
          </div>

          {/* Time (if not all day) */}
          {!allDay && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Start</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ItemStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Conference room / Zoom / ..."
            />
          </div>

          {/* Participants */}
          <div className="space-y-2">
            <Label>Participants</Label>
            <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
              {users.map((user) => (
                <label key={user.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedParticipants.includes(user.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedParticipants([...selectedParticipants, user.id]);
                      } else {
                        setSelectedParticipants(selectedParticipants.filter((id) => id !== user.id));
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">{user.name}</span>
                  <span className="text-xs text-gray-500">({user.email})</span>
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : isEditing ? "Save" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

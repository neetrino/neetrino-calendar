"use client";

import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { Calendar, Clock, MapPin, Users, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useDeleteCalendarItem } from "../hooks/useCalendarItems";
import type { CalendarItemWithRelations } from "../types";
import { ITEM_TYPE_LABELS, STATUS_LABELS, STATUS_COLORS } from "../types";
import { getInitials, stringToColor } from "@/lib/utils";

interface EventModalProps {
  event: CalendarItemWithRelations | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (event: CalendarItemWithRelations) => void;
}

export function EventModal({ event, isOpen, onClose, onEdit }: EventModalProps) {
  const deleteItem = useDeleteCalendarItem();

  if (!event) return null;

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this event?")) return;

    try {
      await deleteItem.mutateAsync(event.id);
      toast.success("Event deleted");
      onClose();
    } catch (error) {
      console.error("[EventModal] Delete error:", error);
      toast.error("Error deleting event");
    }
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit(event);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-xl">{event.title}</DialogTitle>
            </div>
          </div>
        </DialogHeader>

        {/* Badges - outside DialogDescription to avoid hydration error */}
        <div className="flex items-center gap-2 mt-2 mb-4">
          <Badge variant={event.type === "MEETING" ? "meeting" : "deadline"}>
            {ITEM_TYPE_LABELS[event.type as keyof typeof ITEM_TYPE_LABELS]}
          </Badge>
          <Badge variant="outline" className={STATUS_COLORS[event.status as keyof typeof STATUS_COLORS]}>
            {STATUS_LABELS[event.status as keyof typeof STATUS_LABELS]}
          </Badge>
        </div>

        <div className="space-y-4 mt-4">
          {/* Date and time */}
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="font-medium">
                {format(new Date(event.startAt), "d MMMM yyyy", { locale: enUS })}
              </p>
              {!event.allDay && (
                <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                  <Clock className="h-4 w-4" />
                  {format(new Date(event.startAt), "HH:mm")}
                  {event.endAt && ` – ${format(new Date(event.endAt), "HH:mm")}`}
                </p>
              )}
              {event.allDay && <p className="text-sm text-gray-500">All day</p>}
            </div>
          </div>

          {/* Location */}
          {event.location && (
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
              <p>{event.location}</p>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="pt-2 border-t">
              <p className="text-gray-700 whitespace-pre-wrap">{event.description}</p>
            </div>
          )}

          {/* Participants */}
          {event.participants.length > 0 && (
            <div className="pt-2 border-t">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-5 w-5 text-gray-400" />
                <span className="font-medium">Participants ({event.participants.length})</span>
              </div>
              <div className="space-y-2">
                {event.participants.map((participant) => (
                  <div key={participant.id} className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className={stringToColor(participant.user.name)}>
                        {getInitials(participant.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{participant.user.name}</p>
                      <p className="text-xs text-gray-500">{participant.user.email}</p>
                    </div>
                    {participant.rsvp && (
                      <Badge variant="outline" className="text-xs">
                        {participant.rsvp === "YES"
                          ? "Yes"
                          : participant.rsvp === "NO"
                            ? "No"
                            : "Maybe"}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Created by */}
          <div className="pt-2 border-t text-sm text-gray-500">
            Created by: {event.createdBy.name}
          </div>
        </div>

        {/* Actions - only for admin */}
        {onEdit && (
          <div className="flex justify-end gap-2 mt-6">
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteItem.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
            <Button onClick={handleEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

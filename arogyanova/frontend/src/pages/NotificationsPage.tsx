import React, { useEffect, useState } from 'react';
import { Bell, CheckCheck, Clock, AlertCircle, Info, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import type { Notification } from '../types';
import EmptyState from '../components/ui/EmptyState';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/notifications');
      setNotifications(res.data || []);
    } catch {
      toast.error('Failed to load notifications.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      toast.success('Notification marked as read');
    } catch {
      toast.error('Failed to update notification');
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.is_read);
    try {
      await Promise.all(unread.map((n) => api.patch(`/notifications/${n.id}/read`)));
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'high':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'normal':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text">Notifications</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            System announcements, clinical alerts, and prescription status changes
          </p>
        </div>

        {notifications.some((n) => !n.is_read) && (
          <button onClick={markAllAsRead} className="btn-secondary text-xs">
            <CheckCheck className="w-3.5 h-3.5" /> Mark All as Read
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="card divide-y divide-border">
        {isLoading ? (
          <div className="p-8 space-y-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-slate-100 rounded-lg" />
            ))}
          </div>
        ) : notifications.length > 0 ? (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`p-4 flex items-start justify-between gap-4 transition-colors ${
                n.is_read ? 'bg-white' : 'bg-teal-50/20'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-lg mt-0.5 ${
                    n.is_read ? 'bg-slate-100 text-slate-500' : 'bg-primary/10 text-primary'
                  }`}
                >
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-xs text-text">{n.title}</h4>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${getPriorityStyle(
                        n.priority
                      )}`}
                    >
                      {n.priority}
                    </span>
                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-primary" title="Unread" />
                    )}
                  </div>
                  <p className="text-xs text-text-secondary mt-1">{n.message}</p>
                  <span className="text-[10px] text-text-light mt-1.5 block flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(n.created_at).toLocaleString()}
                  </span>
                </div>
              </div>

              {!n.is_read && (
                <button
                  onClick={() => markAsRead(n.id)}
                  className="text-xs font-semibold text-primary hover:underline shrink-0"
                >
                  Mark read
                </button>
              )}
            </div>
          ))
        ) : (
          <EmptyState
            icon={Bell}
            title="All Caught Up!"
            description="You have no notifications in your inbox at the moment."
          />
        )}
      </div>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  Divider,
  Chip,
  CircularProgress,
  Alert,
} from "@mui/material";

const API_BASE_URL = "http://127.0.0.1:8000/api";

export default function Notifications() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    }),
    [token]
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(`${API_BASE_URL}/notifications`, {
        headers: authHeaders,
      });
      const data = await res.json().catch(() => null);

      if (!res.ok)
        throw new Error(data?.message || "Failed to load notifications");

      setItems(data?.notifications || []);
      setUnreadCount(data?.unread_count ?? 0);
    } catch (e) {
      setError(e?.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id) => {
    const res = await fetch(`${API_BASE_URL}/notifications/mark-read/${id}`, {
      method: "POST",
      headers: authHeaders,
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setUnreadCount(data?.unread_count ?? unreadCount);
      setItems((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, read_at: new Date().toISOString() } : n
        )
      );
    }
  };

  const markAll = async () => {
    const res = await fetch(`${API_BASE_URL}/notifications/mark-all-read`, {
      method: "POST",
      headers: authHeaders,
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setUnreadCount(data?.unread_count ?? 0);
      setItems((prev) =>
        prev.map((n) => ({
          ...n,
          read_at: n.read_at || new Date().toISOString(),
        }))
      );
    }
  };

  const deleteOne = async (id) => {
    const res = await fetch(`${API_BASE_URL}/notifications/${id}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setUnreadCount(data?.unread_count ?? unreadCount);
      setItems((prev) => prev.filter((n) => n.id !== id));
    }
  };

  const deleteAll = async () => {
    const res = await fetch(`${API_BASE_URL}/notifications`, {
      method: "DELETE",
      headers: authHeaders,
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setUnreadCount(data?.unread_count ?? 0);
      setItems([]);
    }
  };

  // ✅ أهم جزء: استخراج رابط صحيح للإشعار
  const resolveNotificationUrl = (n) => {
    const payload = n?.data || {}; // {type,title,body,data:{...}}
    const extra = payload?.data || {}; // {project_id, task_id, comment_id, url, ...}

    // 1) لو فيه url جاهز (أحيانًا موجود هون)
    const directUrl = extra?.url || payload?.url;
    if (directUrl) return directUrl;

    // 2) لو ما فيه url: نبنيه حسب النوع والمعرفات
    const projectId = extra?.project_id;
    const taskId = extra?.task_id;
    const commentId = extra?.comment_id;
    const type = payload?.type || "";

    // تعليقات على مشروع
    if (type === "comment.project" && projectId) {
      // إذا عندك تبويب comments بالواجهة استخدم query
      return commentId
        ? `/dashboard/projects/${projectId}?tab=comments&comment_id=${commentId}`
        : `/dashboard/projects/${projectId}?tab=comments`;
    }

    // تعليقات على مهمة
    if (type === "comment.task" && projectId) {
      return `/dashboard/projects/${projectId}?tab=tasks${
        taskId ? `&task_id=${taskId}` : ""
      }${commentId ? `&comment_id=${commentId}` : ""}`;
    }

    // تغيّر حالة مهمة / إنشاء مهمة / إلخ
    if (type.startsWith("task.") && projectId) {
      return `/dashboard/projects/${projectId}?tab=tasks${
        taskId ? `&task_id=${taskId}` : ""
      }`;
    }

    // الافتراضي
    if (projectId) return `/dashboard/projects/${projectId}`;
    return "/dashboard/notifications";
  };

  const handleOpenNotification = async (n) => {
    const url = resolveNotificationUrl(n);

    // ✅ علّم مقروء قبل الانتقال (إذا كان unread)
    if (n?.id && !n?.read_at) {
      await markRead(n.id);
    }

    navigate(url);
  };

  useEffect(() => {
    if (!token) return;
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography color="text.secondary">Loading notifications.</Typography>
        </Stack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 900, mx: "auto" }}>
      <Paper
        elevation={0}
        sx={{ p: 2.5, borderRadius: 3, border: "1px solid #EAEAEA" }}
      >
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography variant="h6" sx={{ fontWeight: 900 }}>
            Notifications
          </Typography>

          <Stack direction="row" spacing={1}>
            <Chip
              label={`Unread: ${unreadCount}`}
              color={unreadCount ? "warning" : "default"}
            />
            <Button size="small" variant="outlined" onClick={fetchAll}>
              Refresh
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={markAll}
              disabled={!unreadCount}
            >
              Mark all read
            </Button>
            <Button
              size="small"
              color="error"
              variant="outlined"
              onClick={deleteAll}
              disabled={!items.length}
            >
              Delete all
            </Button>
          </Stack>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {items.length === 0 ? (
          <Typography color="text.secondary">No notifications.</Typography>
        ) : (
          <Stack spacing={1}>
            {items.map((n) => {
              const payload = n.data || {};
              const extra = payload.data || {};
              const isUnread = !n.read_at;

              const title = payload.title || "Notification";
              const body = payload.body || "";
              const type = payload.type || "system";

              return (
                <Paper
                  key={n.id}
                  variant="outlined"
                  onClick={() => handleOpenNotification(n)}
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    borderColor: "#EFEFEF",
                    bgcolor: isUnread ? "rgba(255,193,7,0.10)" : "transparent",
                    cursor: "pointer",
                    "&:hover": {
                      bgcolor: isUnread
                        ? "rgba(255,193,7,0.14)"
                        : "rgba(0,0,0,0.03)",
                    },
                  }}
                >
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="flex-start"
                    spacing={2}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 900 }}>{title}</Typography>

                      {body ? (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mt: 0.3, whiteSpace: "pre-wrap" }}
                        >
                          {body}
                        </Typography>
                      ) : null}

                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ mt: 1 }}
                        alignItems="center"
                      >
                        <Chip size="small" variant="outlined" label={type} />
                        <Typography variant="caption" color="text.secondary">
                          {n.created_at
                            ? new Date(n.created_at).toLocaleString("ar-EG")
                            : ""}
                        </Typography>
                      </Stack>

                      {/* (اختياري) للتأكد من البيانات أثناء التجريب */}
                      {/* <Typography variant="caption">{JSON.stringify(extra)}</Typography> */}
                    </Box>

                    <Stack direction="row" spacing={1}>
                      {isUnread && (
                        <Button
                          size="small"
                          variant="contained"
                          onClick={(e) => {
                            e.stopPropagation();
                            markRead(n.id);
                          }}
                        >
                          Mark read
                        </Button>
                      )}
                      <Button
                        size="small"
                        color="error"
                        variant="outlined"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteOne(n.id);
                        }}
                      >
                        Delete
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        )}
      </Paper>
    </Box>
  );
}

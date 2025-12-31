import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";

import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  Chip,
  CircularProgress,
  Alert,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TextField,
  MenuItem,
} from "@mui/material";

import AddRoundedIcon from "@mui/icons-material/AddRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import ArrowOutwardRoundedIcon from "@mui/icons-material/ArrowOutwardRounded";

const API_BASE_URL = "http://127.0.0.1:8000/api";

export default function Projects() {
  const { token, user } = useAuth();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newProject, setNewProject] = useState({ title: "", description: "" });
  const [creating, setCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState("");

  const roleName = (user?.role || "").toLowerCase(); // admin / student / supervisor
  const currentUserId = user?.user?.id;

  const canCreateProject = roleName === "student" || roleName === "admin";

  const defaultFilter =
    roleName === "admin"
      ? "all"
      : roleName === "supervisor"
      ? "supervised"
      : "my";

  const [filter, setFilter] = useState(defaultFilter);

  const fetchProjects = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE_URL}/projects`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.message || "تعذر جلب المشاريع من الخادم");
        setProjects([]);
        return;
      }

      setProjects(data?.projects || []);
    } catch (e) {
      setError("حدث خطأ في الاتصال بالسيرفر");
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setCreateMessage("");

    if (!newProject.title.trim()) return;

    try {
      setCreating(true);

      const res = await fetch(`${API_BASE_URL}/project/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: JSON.stringify({
          title: newProject.title,
          description: newProject.description,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setCreateMessage(data?.message || "تعذر إنشاء المشروع");
        return;
      }

      setCreateMessage("✅ تم إنشاء المشروع");
      setNewProject({ title: "", description: "" });
      fetchProjects();
    } catch {
      setCreateMessage("حدث خطأ في الاتصال بالسيرفر أثناء إنشاء المشروع");
    } finally {
      setCreating(false);
    }
  };

  // ✅ فلترة العرض
  const visibleProjects = useMemo(() => {
    // لو ما عندنا user id بعد، اعرض كل شيء كما هو
    if (!currentUserId) return projects;

    // Admin
    if (roleName === "admin") {
      if (filter === "all") return projects;
      if (filter === "my")
        return projects.filter((p) => p.user_id === currentUserId);
      if (filter === "supervised")
        return projects.filter((p) => p.supervisor_id === currentUserId);
      return projects;
    }

    // Supervisor
    if (roleName === "supervisor") {
      if (filter === "my")
        return projects.filter((p) => p.user_id === currentUserId);
      if (filter === "supervised")
        return projects.filter((p) => p.supervisor_id === currentUserId);
      return projects;
    }

    // ✅ Student: لا نفلتر محلياً (الـ API يرجع: مالك + عضو accepted)
    return projects;
  }, [projects, currentUserId, roleName, filter]);

  // ✅ علاقة المستخدم بالمشروع
  const relationChip = (p) => {
    if (!currentUserId) return null;

    const isOwner = p.user_id === currentUserId;
    const isSupervisor = p.supervisor_id === currentUserId;

    if (isOwner) return <Chip size="small" color="warning" label="👑 مالك" />;
    if (isSupervisor) return <Chip size="small" color="info" label="🧑‍🏫 مشرف" />;

    // بما أن المشروع وصل للطالب من API فهو غالباً عضو
    return <Chip size="small" color="success" label="👥 عضو" />;
  };

  return (
    <Box>
      {/* Header */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Typography variant="h5" sx={{ fontWeight: 900 }}>
          Projects
        </Typography>

        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<RefreshRoundedIcon />}
            onClick={fetchProjects}
            sx={{ borderRadius: 2, textTransform: "none", fontWeight: 800 }}
          >
            Refresh
          </Button>
        </Stack>
      </Stack>

      {/* Filters */}
      {(roleName === "supervisor" || roleName === "admin") && (
        <Card sx={{ mb: 2, borderRadius: 3, border: "1px solid #E7E8F0" }}>
          <CardContent>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              alignItems="center"
            >
              <Typography sx={{ fontWeight: 800, color: "text.secondary" }}>
                View:
              </Typography>
              <TextField
                select
                size="small"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                sx={{ width: 260 }}
              >
                {roleName === "admin" && (
                  <MenuItem value="all">All projects</MenuItem>
                )}
                <MenuItem value="supervised">Supervised</MenuItem>
                <MenuItem value="my">My projects</MenuItem>
              </TextField>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Create Project */}
      {canCreateProject && (
        <Card sx={{ mb: 2, borderRadius: 3, border: "1px solid #E7E8F0" }}>
          <CardContent>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 2 }}
            >
              <Typography variant="h6" sx={{ fontWeight: 900 }}>
                Create New Project
              </Typography>
            </Stack>

            {createMessage && (
              <Alert sx={{ mb: 2 }} severity="info">
                {createMessage}
              </Alert>
            )}

            <Box component="form" onSubmit={handleCreateProject}>
              <Stack spacing={2}>
                <TextField
                  label="Title"
                  value={newProject.title}
                  onChange={(e) =>
                    setNewProject((p) => ({ ...p, title: e.target.value }))
                  }
                  required
                />
                <TextField
                  label="Description"
                  value={newProject.description}
                  onChange={(e) =>
                    setNewProject((p) => ({
                      ...p,
                      description: e.target.value,
                    }))
                  }
                  multiline
                  rows={3}
                  required
                />

                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<AddRoundedIcon />}
                  disabled={creating}
                  sx={{
                    borderRadius: 2,
                    textTransform: "none",
                    fontWeight: 900,
                    width: 220,
                  }}
                >
                  {creating ? "Creating..." : "Create"}
                </Button>
              </Stack>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Loading/Error */}
      {loading && (
        <Card sx={{ borderRadius: 3, border: "1px solid #E7E8F0" }}>
          <CardContent>
            <Stack direction="row" spacing={2} alignItems="center">
              <CircularProgress size={22} />
              <Typography sx={{ fontWeight: 700 }}>
                Loading projects...
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      )}

      {!loading && error && <Alert severity="error">{error}</Alert>}

      {!loading && !error && visibleProjects.length === 0 && (
        <Alert severity="warning">No projects to show.</Alert>
      )}

      {/* Table */}
      {!loading && !error && visibleProjects.length > 0 && (
        <Card sx={{ borderRadius: 3, border: "1px solid #E7E8F0" }}>
          <CardContent>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 900 }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Title</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Owner</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Supervisor</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Me</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleProjects.map((p, idx) => (
                  <TableRow key={p.id || idx} hover>
                    <TableCell>{idx + 1}</TableCell>

                    <TableCell sx={{ fontWeight: 800 }}>
                      {p.title || "—"}
                      <Typography
                        variant="caption"
                        sx={{ display: "block", color: "text.secondary" }}
                      >
                        {p.description || ""}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Chip size="small" label={p.status || "pending"} />
                    </TableCell>

                    <TableCell>{p.user?.name || "—"}</TableCell>
                    <TableCell>{p.supervisor?.name || "—"}</TableCell>

                    <TableCell>{relationChip(p)}</TableCell>

                    <TableCell>
                      {p.id ? (
                        <Button
                          component={Link}
                          to={`/dashboard/projects/${p.id}`}
                          variant="outlined"
                          endIcon={<ArrowOutwardRoundedIcon />}
                          sx={{
                            borderRadius: 2,
                            textTransform: "none",
                            fontWeight: 900,
                          }}
                        >
                          Open
                        </Button>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

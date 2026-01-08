import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link as RouterLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// MUI
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  Chip,
  Divider,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  IconButton,
  Tooltip,
} from "@mui/material";

// Icons
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import PersonAddAltRoundedIcon from "@mui/icons-material/PersonAddAltRounded";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import CancelRoundedIcon from "@mui/icons-material/CancelRounded";
import ExitToAppRoundedIcon from "@mui/icons-material/ExitToAppRounded";

const API_BASE_URL = "http://127.0.0.1:8000/api";

export default function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const currentUserId = user?.user?.id;
  const currentRole = user?.role; // "admin" / "student" / "supervisor"

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    }),
    [token]
  );

  // -------------------- Base Data --------------------
  const [project, setProject] = useState(null);

  const [tasks, setTasks] = useState([]);
  const [comments, setComments] = useState([]);
  const [versions, setVersions] = useState([]);

  const [progress, setProgress] = useState({
    total: 0,
    completed: 0,
    percent: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // -------------------- project edit/delete --------------------
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [savingProject, setSavingProject] = useState(false);

  const [deletingProject, setDeletingProject] = useState(false);

  const [commits, setCommits] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [editGithub, setEditGithub] = useState("");

  // -------------------- Task Create --------------------
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    deadline: "",
  });
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskMsg, setTaskMsg] = useState({ type: "", text: "" });

  // -------------------- Comments --------------------
  const [newComment, setNewComment] = useState("");
  const [commentMsg, setCommentMsg] = useState({ type: "", text: "" });
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentValue, setEditingCommentValue] = useState("");

  // -------------------- Versions --------------------
  const [versionTitle, setVersionTitle] = useState("");
  const [versionNote, setVersionNote] = useState("");
  const [versionFile, setVersionFile] = useState(null);
  const [uploadingVersion, setUploadingVersion] = useState(false);
  const [versionMsg, setVersionMsg] = useState({ type: "", text: "" });

  const [editingVersionId, setEditingVersionId] = useState(null);
  const [editVersionTitle, setEditVersionTitle] = useState("");
  const [editVersionDesc, setEditVersionDesc] = useState("");
  const [savingEditVersion, setSavingEditVersion] = useState(false);

  // -------------------- Supervisor invite --------------------
  const [supervisors, setSupervisors] = useState([]);
  const [selectedSupervisor, setSelectedSupervisor] = useState("");
  const [invitingSupervisor, setInvitingSupervisor] = useState(false);
  const [inviteSupervisorMsg, setInviteSupervisorMsg] = useState("");

  // -------------------- Student invite --------------------
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [inviteStudentMsg, setInviteStudentMsg] = useState("");
  const [invitingStudent, setInvitingStudent] = useState(false);
  const [studentsLoadMsg, setStudentsLoadMsg] = useState(""); // ✅ توضيح تحميل الطلاب

  // -------------------- Helpers --------------------
  const statusChip = (status) => {
    const s = (status || "pending").toLowerCase();
    if (s === "completed")
      return <Chip size="small" color="success" label="مكتمل" />;
    if (s === "in_progress")
      return <Chip size="small" color="info" label="قيد التنفيذ" />;
    if (s === "pending")
      return <Chip size="small" color="warning" label="قيد الانتظار" />;
    return <Chip size="small" variant="outlined" label={status || "—"} />;
  };

  const normalizeFileUrl = (v) => {
    if (!v) return v;
    if (v.file_url) return v;
    if (v.file_path) {
      const base = API_BASE_URL.replace("/api", "");
      return { ...v, file_url: `${base}/storage/${v.file_path}` };
    }
    return v;
  };

  // ✅✅ (إضافة فقط) حالة مشتقة من progress
  const derivedProjectStatus = useMemo(() => {
    // إذا لا توجد مهام: ارجع status الحقيقي للمشروع
    if (!progress?.total || Number(progress.total) === 0) {
      return (project?.status || "pending").toLowerCase();
    }

    // إذا توجد مهام: احسب الحالة من نسبة التقدم
    if (Number(progress.percent) >= 100) return "completed";
    if (Number(progress.completed) > 0 || Number(progress.percent) > 0)
      return "in_progress";
    return "pending";
  }, [progress, project?.status]);

  // -------------------- Members (Owner + Students) --------------------
  // NOTE: يعتمد على أن الـ API يرسل project.members (array). إذا اسمها مختلف قلّي.
  const members = Array.isArray(project?.members) ? project.members : [];

  const owner = project?.user
    ? {
        id: project.user.id,
        name: project.user.name,
        email: project.user.email,
      }
    : null;

  const membersWithoutOwner = owner
    ? members.filter((m) => (m.id ?? m.user_id) !== owner.id)
    : members;

  const displayMembers = owner
    ? [owner, ...membersWithoutOwner]
    : membersWithoutOwner;
  const membersCount = displayMembers.length;

  // -------------------- Permissions --------------------
  const canInviteSupervisor =
    (currentRole === "student" &&
      project &&
      currentUserId === project.user_id) ||
    currentRole === "admin";

  const canManageProject =
    currentRole === "admin" ||
    (project && currentUserId === project.user_id) ||
    (project && currentUserId === project.supervisor_id);

  const canUploadVersion =
    currentRole === "admin" ||
    (project && currentUserId === project.user_id) ||
    (project && currentUserId === project.supervisor_id) ||
    currentRole === "student"; // ✅ عضو مشروع (طالما وصل للصفحة)

  const canLeaveSupervision =
    (currentRole === "supervisor" &&
      project &&
      currentUserId === project.supervisor_id) ||
    currentRole === "admin";

  const canEditProject =
    currentRole === "admin" ||
    (project && currentUserId === project.user_id) ||
    (project && currentUserId === project.supervisor_id);

  const canDeleteProject =
    currentRole === "admin" || (project && currentUserId === project.user_id);

  // -------------------- Fetch Lists --------------------
  const fetchSupervisors = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/supervisors`, {
        headers: authHeaders,
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        console.error("fetchSupervisors failed:", res.status, data);
        return;
      }
      setSupervisors(data?.supervisors || []);
    } catch (e) {
      console.error("fetchSupervisors error:", e);
    }
  };

  /**
   * ✅ حل مشكلة عدم ظهور الطلاب:
   * - أولاً يجرب: /project/{id}/students
   * - إذا فشل أو رجع فاضي => fallback إلى: /students
   */
  const fetchStudentsForInvite = async (projectId) => {
    setStudentsLoadMsg("");
    try {
      // 1) حاول endpoint الخاص بالمشروع
      const res1 = await fetch(
        `${API_BASE_URL}/project/${projectId}/students`,
        {
          headers: authHeaders,
        }
      );
      const data1 = await res1.json().catch(() => null);

      if (res1.ok) {
        const list1 = data1?.students || [];
        if (list1.length > 0) {
          setStudents(list1);
          setStudentsLoadMsg(
            `تم تحميل ${list1.length} طالب/طلاب (من المشروع) ✅`
          );
          return;
        }
      } else {
        console.error("students(project) failed:", res1.status, data1);
      }

      // 2) fallback: /students
      const res2 = await fetch(`${API_BASE_URL}/students`, {
        headers: authHeaders,
      });
      const data2 = await res2.json().catch(() => null);

      if (!res2.ok) {
        console.error("students(all) failed:", res2.status, data2);
        setStudents([]);
        setStudentsLoadMsg(
          data2?.message ||
            "تعذر جلب قائمة الطلاب. تأكد من API /students أو /project/{id}/students"
        );
        return;
      }

      const list2 = data2?.students || [];
      setStudents(list2);
      setStudentsLoadMsg(`تم تحميل ${list2.length} طالب/طلاب ✅`);
    } catch (e) {
      console.error("fetchStudentsForInvite error:", e);
      setStudents([]);
      setStudentsLoadMsg("خطأ أثناء الاتصال بالسيرفر لجلب الطلاب");
    }
  };

  // -------------------- Fetch Project Details --------------------
  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    const fetchAll = async () => {
      try {
        setLoading(true);
        setError("");

        const headers = authHeaders;

        const [projectRes, tasksRes, progressRes, commentsRes, versionsRes] =
          await Promise.all([
            fetch(`${API_BASE_URL}/project/${id}`, { headers }),
            fetch(`${API_BASE_URL}/project/${id}/tasks`, { headers }),
            fetch(`${API_BASE_URL}/project/${id}/progress`, { headers }),
            fetch(`${API_BASE_URL}/project/${id}/comments`, { headers }),
            fetch(`${API_BASE_URL}/project/${id}/versions`, { headers }),
          ]);

        const projectJson = await projectRes.json().catch(() => null);
        if (!projectRes.ok)
          throw new Error(projectJson?.message || "تعذر جلب بيانات المشروع");

        const p = projectJson?.project || projectJson;
        setProject(p);
        setEditTitle(p?.title || "");
        setEditDesc(p?.description || "");
        setEditGithub(p?.github_repo_url || "");

        if (tasksRes.ok) {
          const t = await tasksRes.json().catch(() => ({ tasks: [] }));
          setTasks(t?.tasks || []);
        } else setTasks([]);

        if (progressRes.ok) {
          const pr = await progressRes.json().catch(() => null);
          setProgress({
            total: pr?.total_tasks ?? 0,
            completed: pr?.completed_tasks ?? 0,
            percent: pr?.progress_percentage ?? 0,
          });
        } else setProgress({ total: 0, completed: 0, percent: 0 });

        if (commentsRes.ok) {
          const c = await commentsRes.json().catch(() => ({ comments: [] }));
          setComments(c?.comments || []);
        } else setComments([]);

        if (versionsRes.ok) {
          const v = await versionsRes.json().catch(() => ({ versions: [] }));
          setVersions((v?.versions || []).map(normalizeFileUrl));
        } else setVersions([]);

        // ✅ lists
        fetchSupervisors();
        fetchStudentsForInvite(p?.id || id);
      } catch (e) {
        setError(e?.message || "حدث خطأ غير متوقع");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  const handleUpdateProject = async () => {
    if (!project?.id) return;
    if (!editTitle.trim() || !editDesc.trim())
      return alert("أدخل العنوان والوصف");

    try {
      setSavingProject(true);
      const res = await fetch(`${API_BASE_URL}/project/update/${project.id}`, {
        method: "PUT",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          description: editDesc,
          github_repo_url: editGithub || null,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) return alert(data?.message || "تعذر تعديل المشروع");

      const updated = data?.project || data;
      setProject(updated);
      setEditGithub(updated?.github_repo_url || "");

      setEditOpen(false);
      alert("✅ تم تعديل المشروع");
    } catch {
      alert("خطأ أثناء الاتصال بالسيرفر");
    } finally {
      setSavingProject(false);
    }
  };

  // -------------------- project edit/delete --------------------
  const handleDeleteProject = async () => {
    if (!project?.id) return;
    const ok = window.confirm(
      "⚠️ هل أنت متأكد من حذف المشروع؟ لا يمكن التراجع."
    );
    if (!ok) return;

    try {
      setDeletingProject(true);
      const res = await fetch(`${API_BASE_URL}/project/delete/${project.id}`, {
        method: "DELETE",
        headers: authHeaders,
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) return alert(data?.message || "تعذر حذف المشروع");

      alert("✅ تم حذف المشروع");
      navigate("/dashboard/projects");
    } catch {
      alert("خطأ أثناء الاتصال بالسيرفر");
    } finally {
      setDeletingProject(false);
    }
  };

  // -------------------- Supervisor Invite --------------------
  const handleSendSupervisorInvite = async () => {
    setInviteSupervisorMsg("");
    if (!project?.id) return;
    if (!selectedSupervisor)
      return setInviteSupervisorMsg("اختر مشرفاً أولاً.");

    try {
      setInvitingSupervisor(true);
      const res = await fetch(
        `${API_BASE_URL}/project/${project.id}/invite-supervisor`,
        {
          method: "POST",
          headers: { ...authHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ supervisor_id: Number(selectedSupervisor) }),
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok)
        return setInviteSupervisorMsg(data?.message || "فشل إرسال الدعوة");

      setInviteSupervisorMsg("✅ تم إرسال دعوة المشرف بنجاح");
      setSelectedSupervisor("");
    } catch {
      setInviteSupervisorMsg("حدث خطأ أثناء إرسال الدعوة");
    } finally {
      setInvitingSupervisor(false);
    }
  };

  // -------------------- Student Invite --------------------
  const handleInviteStudent = async () => {
    setInviteStudentMsg("");
    if (!project?.id) return;
    if (!selectedStudent) return setInviteStudentMsg("اختر طالباً أولاً.");

    try {
      setInvitingStudent(true);
      const res = await fetch(
        `${API_BASE_URL}/project/${project.id}/invite-student`,
        {
          method: "POST",
          headers: { ...authHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ student_id: Number(selectedStudent) }),
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok)
        return setInviteStudentMsg(data?.message || "فشل إرسال الدعوة");

      setInviteStudentMsg("✅ تم إرسال الدعوة للطالب");
      setStudents((prev) =>
        prev.filter((s) => s.id !== Number(selectedStudent))
      );
      setSelectedStudent("");
    } catch {
      setInviteStudentMsg("حدث خطأ أثناء إرسال الدعوة");
    } finally {
      setInvitingStudent(false);
    }
  };

  // -------------------- Leave Supervision --------------------
  const handleLeaveSupervision = async () => {
    if (!project?.id) return;
    const ok = window.confirm("هل تريد إلغاء الإشراف عن هذا المشروع؟");
    if (!ok) return;

    try {
      const res = await fetch(
        `${API_BASE_URL}/project/${project.id}/leave-supervision`,
        { method: "POST", headers: authHeaders }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) return alert(data?.message || "تعذر إلغاء الإشراف");

      alert("✅ تم إلغاء الإشراف");
      setProject((prev) =>
        prev ? { ...prev, supervisor_id: null, supervisor: null } : prev
      );
    } catch {
      alert("حدث خطأ أثناء الاتصال بالسيرفر");
    }
  };

  // -------------------- Tasks --------------------
  const handleCreateTask = async (e) => {
    e.preventDefault();
    setTaskMsg({ type: "", text: "" });

    if (!newTask.title.trim())
      return setTaskMsg({ type: "error", text: "عنوان المهمة مطلوب." });
    if (!project?.id)
      return setTaskMsg({ type: "error", text: "المشروع غير محمّل بعد." });

    try {
      setCreatingTask(true);
      const res = await fetch(`${API_BASE_URL}/task/create`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          title: newTask.title,
          description: newTask.description || null,
          deadline: newTask.deadline || null,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = data?.errors
          ? Object.entries(data.errors)
              .map(([k, v]) => `${k}: ${v?.[0]}`)
              .join(" | ")
          : data?.message;
        return setTaskMsg({ type: "error", text: msg || "تعذر إنشاء المهمة" });
      }

      setTasks((prev) => [data?.task, ...prev].filter(Boolean));
      setNewTask({ title: "", description: "", deadline: "" });
      setTaskMsg({ type: "success", text: "تم إضافة المهمة بنجاح" });
    } catch {
      setTaskMsg({ type: "error", text: "حدث خطأ أثناء الاتصال بالسيرفر." });
    } finally {
      setCreatingTask(false);
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const res = await fetch(`${API_BASE_URL}/task/update/${taskId}`, {
        method: "PUT",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return alert(data?.message || "تعذر تحديث حالة المهمة");

      const updated = tasks.map((t) =>
        t.id === taskId ? { ...t, status: newStatus } : t
      );
      setTasks(updated);

      const total = updated.length;
      const completed = updated.filter((t) => t.status === "completed").length;
      const percent = total ? Math.round((completed / total) * 100) : 0;
      setProgress({ total, completed, percent });
    } catch {
      alert("حدث خطأ أثناء تحديث الحالة");
    }
  };

  // -------------------- Comments --------------------
  const handleAddComment = async (e) => {
    e.preventDefault();
    setCommentMsg({ type: "", text: "" });

    if (!newComment.trim())
      return setCommentMsg({
        type: "error",
        text: "لا يمكن إرسال تعليق فارغ.",
      });

    try {
      const res = await fetch(`${API_BASE_URL}/project/${id}/comment`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ comment: newComment }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok)
        return setCommentMsg({
          type: "error",
          text: data?.message || "تعذر إرسال التعليق",
        });

      setComments((prev) => [data?.comment, ...prev].filter(Boolean));
      setNewComment("");
      setCommentMsg({ type: "success", text: "تم إضافة التعليق بنجاح" });
    } catch {
      setCommentMsg({ type: "error", text: "حدث خطأ أثناء إرسال التعليق." });
    }
  };

  const handleDeleteComment = async (commentId) => {
    const ok = window.confirm("هل تريد حذف التعليق؟");
    if (!ok) return;

    try {
      const res = await fetch(`${API_BASE_URL}/comment/${commentId}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return alert(data?.message || "تعذر حذف التعليق");

      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {
      alert("حدث خطأ أثناء الحذف");
    }
  };

  const handleUpdateComment = async (commentId) => {
    if (!editingCommentValue.trim()) return alert("لا يمكن حفظ تعليق فارغ");

    try {
      const res = await fetch(`${API_BASE_URL}/comment/${commentId}`, {
        method: "PUT",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ comment: editingCommentValue }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return alert(data?.message || "تعذر تعديل التعليق");

      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? data?.comment || c : c))
      );
      setEditingCommentId(null);
      setEditingCommentValue("");
    } catch {
      alert("حدث خطأ أثناء التعديل");
    }
  };

  // -------------------- Versions --------------------
  const handleUploadVersion = async (e) => {
    e.preventDefault();
    setVersionMsg({ type: "", text: "" });

    if (!versionTitle.trim())
      return setVersionMsg({ type: "error", text: "عنوان الإصدار مطلوب." });
    if (!versionFile)
      return setVersionMsg({ type: "error", text: "اختر ملف الإصدار أولاً." });

    try {
      setUploadingVersion(true);

      const fd = new FormData();
      fd.append("version_title", versionTitle);
      fd.append("version_description", versionNote || "");
      fd.append("file", versionFile);

      const res = await fetch(`${API_BASE_URL}/project/${id}/versions/upload`, {
        method: "POST",
        headers: authHeaders,
        body: fd,
      });

      const data = await res.json().catch(() => null);
      if (!res.ok)
        return setVersionMsg({
          type: "error",
          text: data?.message || "فشل رفع الإصدار",
        });

      setVersions((prev) =>
        [normalizeFileUrl(data?.version), ...prev].filter(Boolean)
      );
      setVersionTitle("");
      setVersionNote("");
      setVersionFile(null);
      setVersionMsg({ type: "success", text: "تم رفع الإصدار بنجاح ✅" });
    } catch {
      setVersionMsg({ type: "error", text: "خطأ أثناء الاتصال بالسيرفر." });
    } finally {
      setUploadingVersion(false);
    }
  };

  const openEditVersion = (v) => {
    setEditingVersionId(v.id);
    setEditVersionTitle(v.version_title || "");
    setEditVersionDesc(v.version_description || "");
  };

  const cancelEditVersion = () => {
    setEditingVersionId(null);
    setEditVersionTitle("");
    setEditVersionDesc("");
  };

  const handleSaveEditVersion = async (e) => {
    e.preventDefault();
    if (!editingVersionId) return;
    if (!editVersionTitle.trim()) return alert("عنوان الإصدار مطلوب");

    try {
      setSavingEditVersion(true);
      const res = await fetch(
        `${API_BASE_URL}/project/versions/${editingVersionId}`,
        {
          method: "PUT",
          headers: { ...authHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({
            version_title: editVersionTitle,
            version_description: editVersionDesc || null,
          }),
        }
      );

      const data = await res.json().catch(() => null);
      if (!res.ok) return alert(data?.message || "فشل تعديل الإصدار");

      setVersions((prev) =>
        prev.map((v) =>
          v.id === editingVersionId
            ? normalizeFileUrl({ ...v, ...data?.version })
            : v
        )
      );
      cancelEditVersion();
    } catch {
      alert("حدث خطأ أثناء تعديل الإصدار");
    } finally {
      setSavingEditVersion(false);
    }
  };

  const handleDeleteVersion = async (versionId) => {
    const ok = window.confirm("هل أنت متأكد من حذف الإصدار؟");
    if (!ok) return;

    try {
      const res = await fetch(`${API_BASE_URL}/project/versions/${versionId}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return alert(data?.message || "فشل حذف الإصدار");

      setVersions((prev) => prev.filter((v) => v.id !== versionId));
    } catch {
      alert("حدث خطأ أثناء حذف الإصدار");
    }
  };
  const fetchCommits = async () => {
    const res = await fetch(`${API_BASE_URL}/project/${id}/commits`, {
      headers: authHeaders,
    });
    const data = await res.json().catch(() => null);
    if (res.ok) setCommits(data?.commits || []);
  };

  const syncCommits = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/project/${id}/sync-commits`, {
        method: "POST",
        headers: authHeaders,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        alert(data?.message || `Sync failed (${res.status})`);
        return;
      }

      // لو حبيت تعرض عدد اللي انضاف
      if (data?.added !== undefined) {
        alert(`✅ Synced: added ${data.added}, updated ${data.updated}`);
      }

      fetchCommits();
    } finally {
      setSyncing(false);
    }
  };

  // -------------------- UI --------------------
  if (loading) {
    return (
      <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography color="text.secondary">
            جارِ تحميل بيانات المشروع...
          </Typography>
        </Stack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button
          variant="outlined"
          onClick={() => navigate(-1)}
          startIcon={<ArrowBackRoundedIcon />}
        >
          رجوع
        </Button>
      </Box>
    );
  }

  if (!project) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">المشروع غير موجود.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: "auto" }}>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{ p: 2.5, borderRadius: 3, border: "1px solid #EAEAEA" }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          justifyContent="space-between"
        >
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              {project.title}
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ mt: 1, flexWrap: "wrap" }}
            >
              {/* ✅✅ تعديل فقط: استخدم الحالة المشتقة بدل project.status */}
              {statusChip(derivedProjectStatus)}

              {project.supervisor?.name && (
                <Chip
                  size="small"
                  icon={<SchoolRoundedIcon />}
                  label={`المشرف: ${project.supervisor.name}`}
                  variant="outlined"
                />
              )}

              {/* ✅ Members count chip */}
              <Chip
                size="small"
                variant="outlined"
                label={`الأعضاء: ${membersCount}`}
              />
            </Stack>
          </Box>

          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            justifyContent="flex-end"
          >
            <Button
              component={RouterLink}
              to="/dashboard/projects"
              variant="outlined"
              startIcon={<ArrowBackRoundedIcon />}
            >
              رجوع
            </Button>

            {canLeaveSupervision && project.supervisor_id && (
              <Button
                color="error"
                variant="contained"
                startIcon={<ExitToAppRoundedIcon />}
                onClick={handleLeaveSupervision}
              >
                إلغاء الإشراف
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>

      {/* Info + Progress */}
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mt: 2 }}>
        <Paper
          elevation={0}
          sx={{ p: 2.5, flex: 1, borderRadius: 3, border: "1px solid #EAEAEA" }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
            معلومات المشروع
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {project.description || "لا يوجد وصف للمشروع."}
          </Typography>

          <Divider sx={{ my: 1.5 }} />

          <Stack spacing={1}>
            <Typography variant="body2">
              <b>صاحب المشروع:</b> {project.user?.name || "—"} (
              {project.user?.email || "—"})
            </Typography>

            <Typography variant="body2">
              <b>GitHub:</b>{" "}
              {project.github_repo_url ? (
                <a
                  href={project.github_repo_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {project.github_repo_url}
                </a>
              ) : (
                "—"
              )}
              <Button
                onClick={syncCommits}
                disabled={syncing || !project.github_repo_url}
              >
                {syncing ? "Sync..." : "Sync Commits"}
              </Button>
            </Typography>

            {/* ✅ Members list */}
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="body2" sx={{ fontWeight: 900, mb: 1 }}>
              أعضاء المشروع
            </Typography>

            {membersCount === 0 ? (
              <Typography variant="body2" color="text.secondary">
                لا يوجد أعضاء بعد.
              </Typography>
            ) : (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {displayMembers.map((m) => {
                  const mid = m.id ?? m.user_id;
                  const isOwner = owner && mid === owner.id;

                  return (
                    <Chip
                      key={mid}
                      size="small"
                      variant={isOwner ? "filled" : "outlined"}
                      icon={
                        isOwner ? (
                          <span style={{ fontSize: 14 }}>👑</span>
                        ) : undefined
                      }
                      label={`${m.name}${m.email ? ` (${m.email})` : ""}${
                        isOwner ? " - مالك المشروع" : ""
                      }`}
                      sx={{ fontWeight: isOwner ? 900 : 700 }}
                    />
                  );
                })}
              </Stack>
            )}

            {/* Settings */}
            {canEditProject && (
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  mt: 2,
                  borderRadius: 3,
                  border: "1px solid #EAEAEA",
                }}
              >
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                    إعدادات المشروع
                  </Typography>

                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="outlined"
                      onClick={() => setEditOpen((v) => !v)}
                      sx={{ borderRadius: 2, fontWeight: 900 }}
                    >
                      {editOpen ? "إغلاق" : "تعديل"}
                    </Button>

                    {canDeleteProject && (
                      <Button
                        color="error"
                        variant="contained"
                        onClick={handleDeleteProject}
                        disabled={deletingProject}
                        sx={{ borderRadius: 2, fontWeight: 900 }}
                      >
                        {deletingProject ? "..." : "حذف المشروع"}
                      </Button>
                    )}
                  </Stack>
                </Stack>

                {editOpen && (
                  <Box sx={{ mt: 2 }}>
                    <Stack spacing={2}>
                      <TextField
                        label="اسم المشروع"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                      />
                      <TextField
                        label="وصف المشروع"
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        multiline
                        minRows={3}
                      />
                      <TextField
                        label="رابط GitHub"
                        value={editGithub}
                        onChange={(e) => setEditGithub(e.target.value)}
                        placeholder="https://github.com/username/repository"
                      />

                      <Button
                        variant="contained"
                        onClick={handleUpdateProject}
                        disabled={savingProject}
                        sx={{ borderRadius: 2, fontWeight: 900, width: 220 }}
                      >
                        {savingProject ? "جاري الحفظ..." : "حفظ التعديلات"}
                      </Button>
                    </Stack>
                  </Box>
                )}
              </Paper>
            )}
          </Stack>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            width: { xs: "100%", md: 360 },
            borderRadius: 3,
            border: "1px solid #EAEAEA",
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
            نسبة التقدّم
          </Typography>

          {progress.total === 0 ? (
            <Typography variant="body2" color="text.secondary">
              لا توجد مهام بعد لحساب نسبة التقدم.
            </Typography>
          ) : (
            <>
              <Stack
                direction="row"
                justifyContent="space-between"
                sx={{ mb: 1 }}
              >
                <Typography variant="body2" color="text.secondary">
                  {progress.percent}% مكتمل
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {progress.completed}/{progress.total}
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={progress.percent}
                sx={{ height: 10, borderRadius: 5 }}
              />
            </>
          )}
        </Paper>
      </Stack>

      {/* Invitations Section */}
      {(canInviteSupervisor || canManageProject) && (
        <Paper
          elevation={0}
          sx={{ p: 2.5, mt: 2, borderRadius: 3, border: "1px solid #EAEAEA" }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2 }}>
            الدعوات
          </Typography>

          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            {/* Invite Supervisor */}
            {canInviteSupervisor && (
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>
                  دعوة مشرف للمشروع
                </Typography>

                {project.supervisor_id ? (
                  <Alert severity="info">
                    تم تعيين مشرف لهذا المشروع مسبقًا.
                  </Alert>
                ) : (
                  <>
                    {inviteSupervisorMsg && (
                      <Alert sx={{ mb: 1 }} severity="info">
                        {inviteSupervisorMsg}
                      </Alert>
                    )}

                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        label="اختر مشرف"
                        value={selectedSupervisor}
                        onChange={(e) => setSelectedSupervisor(e.target.value)}
                      >
                        <MenuItem value="">—</MenuItem>
                        {supervisors.map((s) => (
                          <MenuItem key={s.id} value={s.id}>
                            {s.name} ({s.email})
                          </MenuItem>
                        ))}
                      </TextField>

                      <Button
                        variant="contained"
                        startIcon={<PersonAddAltRoundedIcon />}
                        onClick={handleSendSupervisorInvite}
                        disabled={invitingSupervisor}
                        sx={{ minWidth: 120 }}
                      >
                        {invitingSupervisor ? "..." : "إرسال"}
                      </Button>
                    </Stack>
                  </>
                )}
              </Box>
            )}

            {/* Invite Students */}
            {canManageProject && (
              <Box sx={{ flex: 1 }}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mb: 1 }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    دعوة طالب للانضمام
                  </Typography>

                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => fetchStudentsForInvite(project.id)}
                  >
                    تحديث القائمة
                  </Button>
                </Stack>

                {inviteStudentMsg && (
                  <Alert sx={{ mb: 1 }} severity="info">
                    {inviteStudentMsg}
                  </Alert>
                )}

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="اختر طالب"
                    value={selectedStudent}
                    onChange={(e) => setSelectedStudent(e.target.value)}
                  >
                    <MenuItem value="">—</MenuItem>
                    {students.map((s) => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.name} ({s.email})
                      </MenuItem>
                    ))}
                  </TextField>

                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<PersonAddAltRoundedIcon />}
                    onClick={handleInviteStudent}
                    disabled={invitingStudent}
                    sx={{ minWidth: 120 }}
                  >
                    {invitingStudent ? "..." : "دعوة"}
                  </Button>
                </Stack>

                {students.length === 0 && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 1 }}
                  >
                    لا توجد أسماء طلاب في القائمة. افتح Console وتأكد من رد API
                    <b> /project/{project.id}/students</b> أو <b>/students</b>.
                  </Typography>
                )}
              </Box>
            )}
          </Stack>
        </Paper>
      )}

      {/* Tasks */}
      <Paper
        elevation={0}
        sx={{ p: 2.5, mt: 2, borderRadius: 3, border: "1px solid #EAEAEA" }}
      >
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mb: 2 }}
        >
          <Typography id="tasks" variant="subtitle1" sx={{ fontWeight: 800 }}>
            المهام
          </Typography>
        </Stack>

        <Box component="form" onSubmit={handleCreateTask} sx={{ mb: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
            <TextField
              fullWidth
              size="small"
              label="عنوان المهمة"
              value={newTask.title}
              onChange={(e) =>
                setNewTask((p) => ({ ...p, title: e.target.value }))
              }
            />
            <TextField
              fullWidth
              size="small"
              label="وصف (اختياري)"
              value={newTask.description}
              onChange={(e) =>
                setNewTask((p) => ({ ...p, description: e.target.value }))
              }
            />
            <TextField
              size="small"
              type="date"
              label="الموعد النهائي"
              InputLabelProps={{ shrink: true }}
              value={newTask.deadline}
              onChange={(e) =>
                setNewTask((p) => ({ ...p, deadline: e.target.value }))
              }
              sx={{ minWidth: 200 }}
            />
            <Button type="submit" variant="contained" disabled={creatingTask}>
              {creatingTask ? "..." : "إضافة"}
            </Button>
          </Stack>

          {taskMsg.text && (
            <Alert
              severity={taskMsg.type === "error" ? "error" : "success"}
              sx={{ mt: 1 }}
            >
              {taskMsg.text}
            </Alert>
          )}
        </Box>

        {tasks.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            لا توجد مهام حالياً.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>العنوان</TableCell>
                  <TableCell>الحالة</TableCell>
                  <TableCell>الموعد النهائي</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tasks.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell sx={{ fontWeight: 700 }}>{t.title}</TableCell>
                    <TableCell>
                      <TextField
                        select
                        size="small"
                        value={t.status || "pending"}
                        onChange={(e) =>
                          handleStatusChange(t.id, e.target.value)
                        }
                        sx={{ minWidth: 160 }}
                      >
                        <MenuItem value="pending">قيد الانتظار</MenuItem>
                        <MenuItem value="in_progress">قيد التنفيذ</MenuItem>
                        <MenuItem value="completed">مكتملة</MenuItem>
                      </TextField>
                    </TableCell>
                    <TableCell>
                      {t.deadline
                        ? new Date(t.deadline).toLocaleDateString("ar-EG")
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* ✅ Comments + Versions side-by-side */}
      <Stack direction={{ xs: "column", lg: "row" }} spacing={2} sx={{ mt: 2 }}>
        {/* Comments */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            flex: 1,
            minWidth: 0,
            borderRadius: 3,
            border: "1px solid #EAEAEA",
          }}
        >
          <Typography
            id="comments"
            variant="subtitle1"
            sx={{ fontWeight: 800, mb: 2 }}
          >
            التعليقات
          </Typography>

          <Box component="form" onSubmit={handleAddComment} sx={{ mb: 2 }}>
            {/* ✅ أصغر مثل tasks */}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField
                fullWidth
                multiline
                minRows={1}
                maxRows={4}
                size="small"
                label="اكتب تعليقك"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
              />
              <Button type="submit" variant="contained" sx={{ minWidth: 120 }}>
                إرسال
              </Button>
            </Stack>

            {commentMsg.text && (
              <Alert
                severity={commentMsg.type === "error" ? "error" : "success"}
                sx={{ mt: 1 }}
              >
                {commentMsg.text}
              </Alert>
            )}
          </Box>

          {comments.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              لا توجد تعليقات بعد.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {comments.map((c) => {
                const canEdit = currentUserId && c.user_id === currentUserId;
                const canDelete = currentRole === "admin" || canEdit;
                const isEditing = editingCommentId === c.id;

                return (
                  <Paper
                    key={c.id}
                    variant="outlined"
                    sx={{ p: 1.5, borderRadius: 2, borderColor: "#EFEFEF" }}
                  >
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="flex-start"
                    >
                      <Box>
                        <Typography sx={{ fontWeight: 800 }}>
                          {c.user?.name || "مستخدم"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {c.created_at
                            ? new Date(c.created_at).toLocaleString("ar-EG")
                            : ""}
                        </Typography>
                      </Box>

                      {(canEdit || canDelete) && (
                        <Stack direction="row" spacing={0.5}>
                          {canEdit && !isEditing && (
                            <Tooltip title="تعديل">
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setEditingCommentId(c.id);
                                  setEditingCommentValue(c.comment || "");
                                }}
                              >
                                <EditRoundedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}

                          {canDelete && (
                            <Tooltip title="حذف">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteComment(c.id)}
                              >
                                <DeleteOutlineRoundedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      )}
                    </Stack>

                    <Box sx={{ mt: 1 }}>
                      {isEditing ? (
                        <>
                          <TextField
                            fullWidth
                            multiline
                            minRows={2}
                            value={editingCommentValue}
                            onChange={(e) =>
                              setEditingCommentValue(e.target.value)
                            }
                          />
                          <Stack
                            direction="row"
                            spacing={1}
                            justifyContent="flex-end"
                            sx={{ mt: 1 }}
                          >
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={<SaveRoundedIcon />}
                              onClick={() => handleUpdateComment(c.id)}
                            >
                              حفظ
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<CancelRoundedIcon />}
                              onClick={() => {
                                setEditingCommentId(null);
                                setEditingCommentValue("");
                              }}
                            >
                              إلغاء
                            </Button>
                          </Stack>
                        </>
                      ) : (
                        <Typography
                          variant="body2"
                          sx={{ whiteSpace: "pre-wrap" }}
                        >
                          {c.comment}
                        </Typography>
                      )}
                    </Box>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Paper>

        {/* Versions */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            flex: 1,
            minWidth: 0,
            borderRadius: 3,
            border: "1px solid #EAEAEA",
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2 }}>
            إصدارات المشروع (Versions)
          </Typography>

          {!canUploadVersion && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              لا يمكنك رفع إصدارات لهذا المشروع (فقط صاحب
              المشروع/المشرف/الأدمن).
            </Alert>
          )}

          {canUploadVersion && (
            <Box component="form" onSubmit={handleUploadVersion} sx={{ mb: 2 }}>
              {/* ✅ أصغر وتوزيع مثل tasks */}
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField
                  fullWidth
                  size="small"
                  label="عنوان الإصدار"
                  value={versionTitle}
                  onChange={(e) => setVersionTitle(e.target.value)}
                />
                <TextField
                  fullWidth
                  size="small"
                  label="وصف (اختياري)"
                  value={versionNote}
                  onChange={(e) => setVersionNote(e.target.value)}
                />
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<UploadFileRoundedIcon />}
                  sx={{ minWidth: 170 }}
                >
                  اختيار ملف
                  <input
                    hidden
                    type="file"
                    onChange={(e) =>
                      setVersionFile(e.target.files?.[0] || null)
                    }
                  />
                </Button>

                <Button
                  type="submit"
                  variant="contained"
                  disabled={uploadingVersion}
                  sx={{ minWidth: 110 }}
                >
                  {uploadingVersion ? "..." : "رفع"}
                </Button>
              </Stack>

              {versionFile && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mt: 1 }}
                >
                  الملف: {versionFile.name}
                </Typography>
              )}

              {versionMsg.text && (
                <Alert
                  severity={versionMsg.type === "error" ? "error" : "success"}
                  sx={{ mt: 1 }}
                >
                  {versionMsg.text}
                </Alert>
              )}
            </Box>
          )}

          {editingVersionId && (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 1 }}
              >
                <Typography sx={{ fontWeight: 800 }}>
                  تعديل الإصدار #{editingVersionId}
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={cancelEditVersion}
                  startIcon={<CancelRoundedIcon />}
                >
                  إلغاء
                </Button>
              </Stack>

              <Box component="form" onSubmit={handleSaveEditVersion}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                  <TextField
                    fullWidth
                    size="small"
                    label="عنوان الإصدار"
                    value={editVersionTitle}
                    onChange={(e) => setEditVersionTitle(e.target.value)}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    label="الوصف"
                    value={editVersionDesc}
                    onChange={(e) => setEditVersionDesc(e.target.value)}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={savingEditVersion}
                    startIcon={<SaveRoundedIcon />}
                    sx={{ minWidth: 120 }}
                  >
                    {savingEditVersion ? "..." : "حفظ"}
                  </Button>
                </Stack>
              </Box>
            </Paper>
          )}

          {versions.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              لا توجد إصدارات بعد.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {versions.map((v) => {
                const ownerId = v.user_id ?? v.user?.id;
                const canEditV = currentUserId && ownerId === currentUserId;
                const canDeleteV = currentRole === "admin" || canEditV;

                return (
                  <Paper
                    key={v.id}
                    variant="outlined"
                    sx={{ p: 1.5, borderRadius: 2, borderColor: "#EFEFEF" }}
                  >
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="flex-start"
                      spacing={1}
                    >
                      <Box>
                        <Typography sx={{ fontWeight: 800 }}>
                          {v.version_title || `Version #${v.id}`}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {v.created_at
                            ? new Date(v.created_at).toLocaleString("ar-EG")
                            : ""}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mt: 1 }}
                        >
                          {v.version_description || "بدون وصف"}
                        </Typography>
                      </Box>

                      <Stack direction="row" spacing={0.5}>
                        {v.file_url ? (
                          <Button
                            size="small"
                            variant="outlined"
                            component="a"
                            href={v.file_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            تحميل
                          </Button>
                        ) : (
                          <Chip
                            size="small"
                            label="لا يوجد ملف"
                            variant="outlined"
                          />
                        )}

                        {canEditV && (
                          <Tooltip title="تعديل">
                            <IconButton
                              size="small"
                              onClick={() => openEditVersion(v)}
                            >
                              <EditRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}

                        {canDeleteV && (
                          <Tooltip title="حذف">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteVersion(v.id)}
                            >
                              <DeleteOutlineRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Paper>
      </Stack>
    </Box>
  );
}

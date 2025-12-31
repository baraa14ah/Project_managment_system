import React, { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Avatar,
  IconButton,
  TextField,
  InputAdornment,
  Button,
  Stack,
  Menu,
  MenuItem,
} from "@mui/material";

import SearchIcon from "@mui/icons-material/Search";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import MailRoundedIcon from "@mui/icons-material/MailRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import SupervisorAccountRoundedIcon from "@mui/icons-material/SupervisorAccountRounded";
import PersonAddAltRoundedIcon from "@mui/icons-material/PersonAddAltRounded";
import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";

const drawerWidth = 280;

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const roleName = String(user?.role?.name ?? user?.role ?? "").toLowerCase();
  const isAdmin = roleName === "admin";
  const isSupervisor = roleName === "supervisor";
  const isStudent = roleName === "student";

  const displayName = user?.user?.name || "User";

  // ✅ Menu state (Profile / Logout)
  const [anchorEl, setAnchorEl] = useState(null);
  const menuOpen = Boolean(anchorEl);

  const handleOpenMenu = (e) => setAnchorEl(e.currentTarget);
  const handleCloseMenu = () => setAnchorEl(null);

  const handleGoProfile = () => {
    handleCloseMenu();
    navigate("/dashboard/profile");
  };

  const handleLogout = () => {
    handleCloseMenu();
    logout();
    navigate("/login");
  };

  // ملاحظة: دعوات المشرف -> supervisor/admin فقط
  // دعوات الطالب -> student/admin فقط
  const navItems = [
    { label: "Home", to: "/dashboard", icon: <HomeRoundedIcon /> },
    {
      label: "Projects",
      to: "/dashboard/projects",
      icon: <FolderRoundedIcon />,
    },
    {
      label: "Notifications",
      to: "/dashboard/notifications",
      icon: <NotificationsRoundedIcon />,
    },

    // ✅ تظهر فقط للمشرف/الأدمن
    {
      label: "Supervisor Invitations",
      to: "/dashboard/supervisor/invitations",
      icon: <SupervisorAccountRoundedIcon />,
      hidden: !(isSupervisor || isAdmin),
    },

    // ✅ تظهر فقط للطالب/الأدمن
    {
      label: "Student Invitations",
      to: "/dashboard/student/invitations",
      icon: <PersonAddAltRoundedIcon />,
      hidden: !(isStudent || isAdmin),
    },

    // عناصر شكلية (لو ما عندك صفحات لها خَلِّها hidden)
    {
      label: "Messages",
      to: "/dashboard/messages",
      icon: <MailRoundedIcon />,
      hidden: true,
    },
    {
      label: "Tasks",
      to: "/dashboard/tasks",
      icon: <TaskAltRoundedIcon />,
      hidden: true,
    },
    {
      label: "Members",
      to: "/dashboard/members",
      icon: <GroupRoundedIcon />,
      hidden: true,
    },
    {
      label: "Settings",
      to: "/dashboard/settings",
      icon: <SettingsRoundedIcon />,
      hidden: true,
    },
  ];

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#F6F7FB" }}>
      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: "border-box",
            borderRight: "1px solid #E7E8F0",
            bgcolor: "#FFFFFF",
            px: 2,
            py: 2,
          },
        }}
      >
        {/* Brand */}
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ px: 1, pb: 1 }}
        >
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: 999,
              bgcolor: "primary.main",
            }}
          />
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            ByteHub
          </Typography>
        </Stack>

        <Divider sx={{ my: 1.5 }} />

        {/* User card */}
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          sx={{ px: 1, pb: 1.5 }}
        >
          <Avatar sx={{ bgcolor: "primary.main" }}>
            {(displayName?.[0] || "U").toUpperCase()}
          </Avatar>
          <Box>
            <Typography sx={{ fontWeight: 700, lineHeight: 1.1 }}>
              {displayName}
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              Role: {roleName || "—"}
            </Typography>
          </Box>
        </Stack>

        <Divider sx={{ mb: 1 }} />

        {/* Navigation */}
        <List sx={{ px: 0 }}>
          {navItems
            .filter((x) => !x.hidden)
            .map((item) => {
              const active =
                location.pathname === item.to ||
                location.pathname.startsWith(item.to + "/");

              return (
                <ListItemButton
                  key={item.to}
                  component={NavLink}
                  to={item.to}
                  sx={{
                    borderRadius: 2,
                    mb: 0.5,
                    px: 1.25,
                    bgcolor: active ? "rgba(79,70,229,0.10)" : "transparent",
                    "&:hover": { bgcolor: "rgba(79,70,229,0.08)" },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 40,
                      color: active ? "primary.main" : "text.secondary",
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontWeight: active ? 800 : 600,
                      color: active ? "primary.main" : "text.primary",
                    }}
                  />
                </ListItemButton>
              );
            })}
        </List>

        <Box sx={{ flexGrow: 1 }} />

        <Divider sx={{ mt: 1 }} />

        {/* Logout (Sidebar) */}
        <Button
          onClick={handleLogout}
          startIcon={<LogoutRoundedIcon />}
          sx={{
            mt: 2,
            borderRadius: 2,
            textTransform: "none",
            fontWeight: 700,
            justifyContent: "flex-start",
            px: 1.5,
          }}
          variant="outlined"
          color="primary"
          fullWidth
        >
          Logout
        </Button>
      </Drawer>

      {/* Main */}
      <Box sx={{ flexGrow: 1, p: 3 }}>
        {/* Topbar */}
        <Box
          sx={{
            bgcolor: "#FFFFFF",
            border: "1px solid #E7E8F0",
            borderRadius: 3,
            px: 2,
            py: 1.5,
            mb: 3,
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          <TextField
            size="small"
            placeholder="Search for anything..."
            sx={{ width: 420, bgcolor: "#F7F7FB", borderRadius: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <Box sx={{ flexGrow: 1 }} />

          <IconButton>
            <NotificationsRoundedIcon />
          </IconButton>

          {/* ✅ Clickable user area -> opens menu */}
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            onClick={handleOpenMenu}
            role="button"
            tabIndex={0}
            sx={{
              cursor: "pointer",
              px: 1,
              py: 0.6,
              borderRadius: 2,
              "&:hover": { bgcolor: "rgba(0,0,0,0.04)" },
              userSelect: "none",
            }}
          >
            <Avatar sx={{ width: 34, height: 34, bgcolor: "primary.main" }}>
              {(displayName?.[0] || "U").toUpperCase()}
            </Avatar>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: 14 }}>
                {displayName}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {roleName || "—"}
              </Typography>
            </Box>
          </Stack>

          {/* ✅ Menu */}
          <Menu
            anchorEl={anchorEl}
            open={menuOpen}
            onClose={handleCloseMenu}
            transformOrigin={{ horizontal: "right", vertical: "top" }}
            anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
            PaperProps={{
              sx: {
                mt: 1,
                minWidth: 220,
                borderRadius: 3,
                border: "1px solid",
                borderColor: "divider",
              },
            }}
          >
            <Box sx={{ px: 2, py: 1.4 }}>
              <Typography sx={{ fontWeight: 900 }}>{displayName}</Typography>
              <Typography variant="caption" color="text.secondary">
                {roleName || "—"}
              </Typography>
            </Box>

            <Divider />

            <MenuItem onClick={handleGoProfile}>
              <ListItemIcon sx={{ minWidth: 34 }}>
                <AccountCircleRoundedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Profile" />
            </MenuItem>

            <Divider />

            <MenuItem onClick={handleLogout} sx={{ color: "error.main" }}>
              <ListItemIcon sx={{ minWidth: 34, color: "error.main" }}>
                <LogoutRoundedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Logout" />
            </MenuItem>
          </Menu>
        </Box>

        {/* Content */}
        <Outlet />
      </Box>
    </Box>
  );
}

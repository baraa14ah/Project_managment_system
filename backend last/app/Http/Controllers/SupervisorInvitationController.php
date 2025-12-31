<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use App\Models\Project;
use App\Models\SupervisorInvitation;

class SupervisorInvitationController extends Controller
{
    // 1) جلب المشرفين للطالب (قائمة dropdown)
    public function supervisorsList(Request $request)
    {
        $user = $request->user();
        if (!$user) return response()->json(['message' => 'Unauthenticated'], 401);

        // رجّع فقط المستخدمين اللي دورهم supervisor
        $supervisors = User::whereHas('role', function($q){
            $q->where('name', 'supervisor');
        })->select('id','name','email')->get();

        return response()->json(['supervisors' => $supervisors]);
    }

    // 2) الطالب يرسل دعوة للمشرف على مشروعه
    public function inviteSupervisor(Request $request, $projectId)
    {
        $user = $request->user(); // الطالب
        if (!$user) return response()->json(['message' => 'Unauthenticated'], 401);

        $request->validate([
            'supervisor_id' => 'required|exists:users,id'
        ]);

        $project = Project::find($projectId);
        if (!$project) return response()->json(['message' => 'Project not found'], 404);

        // فقط صاحب المشروع (الطالب) يرسل الدعوة (أو admin)
        $role = $user->role?->name;
        if ($role !== 'admin' && $project->user_id !== $user->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // لا ترسل دعوة مكررة pending لنفس المشروع + المشرف
        $exists = SupervisorInvitation::where('project_id', $projectId)
            ->where('student_id', $project->user_id)
            ->where('supervisor_id', $request->supervisor_id)
           
            ->exists();

        if ($exists) {
            return response()->json(['message' => 'دعوة معلّقة موجودة بالفعل'], 422);
        }

        $inv = SupervisorInvitation::create([
            'project_id' => $projectId,
            'student_id' => $project->user_id,         // ✅ الطالب صاحب المشروع
            'supervisor_id' => $request->supervisor_id,
            'status' => 'pending'
        ]);

        return response()->json([
            'message' => 'Invitation sent',
            'invitation' => $inv
        ], 201);
    }

    // 3) المشرف يرى دعواته + بيانات الطالب + المشروع
    public function myInvitations(Request $request)
    {
        $user = $request->user();
        if (!$user) return response()->json(['message' => 'Unauthenticated'], 401);

        // (اختياري) حصرها للمشرف/أدمن
        $role = $user->role?->name;
        if ($role !== 'supervisor' && $role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $invitations = SupervisorInvitation::where('supervisor_id', $user->id)
            ->where('status', 'pending')
            ->with([
                'project:id,title,user_id,supervisor_id',
                'student:id,name,email'
            ])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['invitations' => $invitations]);
    }

    // 4) قبول الدعوة -> ربط المشروع بالمشرف
    public function accept(Request $request, $inviteId)
    {
        $user = $request->user(); // المشرف
        if (!$user) return response()->json(['message' => 'Unauthenticated'], 401);

        $inv = SupervisorInvitation::where('id', $inviteId)
            ->where('supervisor_id', $user->id)
            ->where('status', 'pending')
            ->first();

        if (!$inv) return response()->json(['message' => 'Invitation not found'], 404);

        $inv->status = 'accepted';
        $inv->save();

        $project = Project::find($inv->project_id);
        if ($project) {
            $project->supervisor_id = $user->id; // ✅ ربط فعلي
            $project->save();
        }

        return response()->json(['message' => 'Accepted', 'project' => $project]);
    }

    // 5) رفض الدعوة
    public function reject(Request $request, $inviteId)
    {
        $user = $request->user();
        if (!$user) return response()->json(['message' => 'Unauthenticated'], 401);

        $inv = SupervisorInvitation::where('id', $inviteId)
            ->where('supervisor_id', $user->id)
            ->where('status', 'pending')
            ->first();

        if (!$inv) return response()->json(['message' => 'Invitation not found'], 404);

        $inv->status = 'rejected';
        $inv->save();

        return response()->json(['message' => 'Rejected']);
    }
}

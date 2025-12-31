<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Models\StudentInvitation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\User;
class StudentInvitationController extends Controller
{
    private function canManageProject(Request $request, Project $project): bool
    {
        $u = $request->user();
        if (!$u) return false;

        $role = $u->role?->name ?? $u->role; // حسب مشروعك
        return $role === 'admin'
            || $project->user_id === $u->id
            || $project->supervisor_id === $u->id;
    }

    // ✅ إرسال دعوة لطالب
    public function invite(Request $request, $projectId)
    {
        $request->validate([
            'student_id' => 'required|integer|exists:users,id',
        ]);

        $project = Project::find($projectId);
        if (!$project) return response()->json(['message' => 'Project not found'], 404);

        if (!$this->canManageProject($request, $project)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $studentId = (int) $request->student_id;

        // إذا الطالب هو مالك المشروع
        if ($studentId === (int) $project->user_id) {
            return response()->json(['message' => 'This student is already the project owner'], 422);
        }

        // ✅ إذا هو عضو مسبقاً "accepted" خلاص لا ترسل دعوة
        $alreadyAccepted = DB::table('project_members')
            ->where('project_id', $projectId)
            ->where('student_id', $studentId)
        
            ->exists();

        if ($alreadyAccepted) {
            return response()->json(['message' => 'Student already in this project'], 422);
        }

        // ✅ إذا موجودة دعوة pending سابقاً لا تكررها (اختياري لكن مفيد)
        $alreadyPending = StudentInvitation::where('project_id', $projectId)
            ->where('student_id', $studentId)
            ->where('status', 'pending')
            ->exists();

        if ($alreadyPending) {
            return response()->json(['message' => 'Invitation already sent and pending'], 422);
        }

        // إنشاء دعوة جديدة (أو تحديث لو كانت rejected/accepted سابقاً)
        $inv = StudentInvitation::updateOrCreate(
            ['project_id' => $projectId, 'student_id' => $studentId],
            ['sent_by_id' => $request->user()->id, 'status' => 'pending']
        );

        return response()->json([
            'message' => 'Invitation sent',
            'invitation' => $inv
        ], 201);
    }

    // ✅ قائمة دعوات الطالب
    public function myInvitations(Request $request)
    {
        $u = $request->user();
        if (!$u) return response()->json(['message' => 'Unauthenticated'], 401);

        $items = StudentInvitation::query()
            ->where('student_id', $u->id)
            ->where('status', 'pending')
            ->with([
                'project:id,title,user_id,supervisor_id',
                'sender:id,name,email',
            ])
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($i) {
                return [
                    'id' => $i->id,
                    'status' => $i->status,
                    'created_at' => $i->created_at,
                    'project' => [
                        'id' => $i->project?->id,
                        'title' => $i->project?->title,
                    ],
                    'sent_by' => [
                        'id' => $i->sender?->id,
                        'name' => $i->sender?->name,
                        'email' => $i->sender?->email,
                    ],
                ];
            });

        return response()->json(['invitations' => $items]);
    }

    // ✅ قبول الدعوة => إضافة للـ project_members + status=accepted
    public function accept(Request $request, $inviteId)
{
    $u = $request->user();
    if (!$u) return response()->json(['message' => 'Unauthenticated'], 401);

    $inv = StudentInvitation::find($inviteId);
    if (!$inv) return response()->json(['message' => 'Invitation not found'], 404);

    if ((int)$inv->student_id !== (int)$u->id) {
        return response()->json(['message' => 'Unauthorized'], 403);
    }

    if ($inv->status !== 'pending') {
        return response()->json(['message' => 'Invitation already processed'], 422);
    }

    DB::transaction(function () use ($inv, $u) {
        DB::table('project_members')->updateOrInsert(
            ['project_id' => $inv->project_id, 'student_id' => $u->id],
            ['status' => 'accepted', 'created_at' => now(), 'updated_at' => now()]
        );

        $inv->status = 'accepted';
        $inv->save();
    });

    return response()->json(['message' => 'Accepted']);
}


    // ✅ رفض الدعوة
    public function reject(Request $request, $inviteId)
    {
        $u = $request->user();
        if (!$u) return response()->json(['message' => 'Unauthenticated'], 401);

        $inv = StudentInvitation::find($inviteId);
        if (!$inv) return response()->json(['message' => 'Invitation not found'], 404);

        if ((int) $inv->student_id !== (int) $u->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($inv->status !== 'pending') {
            return response()->json(['message' => 'Invitation already processed'], 422);
        }

        $inv->status = 'rejected';
        $inv->save();

        return response()->json(['message' => 'Rejected']);
    }


    public function studentsList(Request $request)
    {
        $u = $request->user();
        if (!$u) return response()->json(['message' => 'Unauthenticated'], 401);
    
        // (اختياري) اسمح فقط لمالك المشروع/مشرف/أدمن باستدعائها
        // إذا تريدها للجميع احذف هذا الشرط.
        $role = $u->role?->name ?? $u->role;
        if (!in_array($role, ['admin', 'student', 'supervisor'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
    
        // ✅ هذي أهم نقطة: فلترة الطلاب حسب role_id الخاص بالـ student عندك
        // عدّل الرقم حسب جدول roles عندك (مثلاً student=2 أو 3)
        $STUDENT_ROLE_ID = 2;
    
        $students = User::query()
            ->select('id', 'name', 'email')
            ->where('role_id', $STUDENT_ROLE_ID)
            ->orderBy('name')
            ->get();
    
        return response()->json(['students' => $students]);
    }
}

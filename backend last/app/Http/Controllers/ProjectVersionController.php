<?php

namespace App\Http\Controllers;

use Carbon\Carbon;
use App\Models\Project;
use Illuminate\Http\Request;
use App\Models\ProjectVersion;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;
use App\Services\NotificationService; // ✅ NEW

class ProjectVersionController extends Controller
{
    protected NotificationService $notifications; // ✅ NEW

    public function __construct(NotificationService $notifications) // ✅ NEW
    {
        $this->notifications = $notifications;
    }

    private function canAccessProject(Request $request, Project $project): bool
    {
        $user = $request->user();
        if (!$user) return false;

        $role = $user->role?->name;

        // ✅ عضو مشروع؟
        $isMember = DB::table('project_members')
            ->where('project_id', $project->id)
            ->where('student_id', $user->id)
            ->where('status', 'accepted')
            ->exists();

        return $role === 'admin'
            || $project->user_id === $user->id
            || $project->supervisor_id === $user->id
            || $isMember;
    }

    // ✅ رفع إصدار جديد + إشعار
    public function upload(Request $request, $projectId)
    {
        $request->validate([
            'version_title' => 'required|string|max:255',
            'version_description' => 'nullable|string',
            'file' => 'required|file',
        ]);

        $project = Project::find($projectId);
        if (!$project) {
            return response()->json(['message' => 'Project not found'], 404);
        }

        if (!$this->canAccessProject($request, $project)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $path = $request->file('file')->store('versions', 'public');

        $version = ProjectVersion::create([
            'project_id' => $projectId,
            'user_id' => $request->user()->id,
            'version_title' => $request->version_title,
            'version_description' => $request->version_description,
            'file_path' => $path,
        ]);

        // ================================
        // ✅ NEW: Send notification to project participants
        // ================================
        try {
            // حتى يظهر عنوان المشروع في النص بشكل جميل (اختياري)
            $project->load(['user', 'supervisor']);

            $actor = $request->user();
            $title = 'تم رفع إصدار جديد';
            $body  = "قام {$actor->name} برفع إصدار: {$version->version_title} داخل مشروع {$project->title}";

            $this->notifications->notifyProject(
                project: $project,
                type: 'version_uploaded',
                title: $title,
                body: $body,
                data: [
                    'project_id' => $project->id,
                    'project_title' => $project->title,
                    'version_id' => $version->id,
                    'version_title' => $version->version_title,
                    'actor_id' => $actor->id,
                    'actor_name' => $actor->name,
                    // رابط تقدر تستخدمه في الفرونت للتوجيه مباشرة
                    'url' => "/dashboard/projects/{$project->id}",
                ],
                ignoreUserId: $actor->id // ✅ لا ترسل له إشعار عن نفسه
            );
        } catch (\Throwable $e) {
            // لا توقف رفع الإصدار إذا فشل الإشعار
            // يمكنك تسجيله لو تحب:
            // \Log::error($e);
        }

        return response()->json([
            'message' => 'Version uploaded successfully',
            'version' => $version->load('user:id,name'),
        ], 201);
    }

    // عرض جميع الإصدارات
    public function index(Request $request, $projectId)
    {
        $project = Project::find($projectId);
        if (!$project) return response()->json(['message' => 'Project not found'], 404);

        if (!$this->canAccessProject($request, $project)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $versions = ProjectVersion::where('project_id', $projectId)
            ->with('user:id,name')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($v) {
                return [
                    'id' => $v->id,
                    'project_id' => $v->project_id,
                    'version_title' => $v->version_title,
                    'version_description' => $v->version_description,
                    'file_url' => $v->file_path ? asset('storage/' . $v->file_path) : null,
                    'uploaded_by' => $v->user?->name,
                    'created_at' => $v->created_at,
                    'user' => $v->user,
                ];
            });

        return response()->json([
            'project_id' => $projectId,
            'versions' => $versions
        ]);
    }

    // ✅ تحديث إصدار
    public function update(Request $request, $versionId)
    {
        $request->validate([
            'version_title' => 'required|string|max:255',
            'version_description' => 'nullable|string',
            'file' => 'nullable|file',
        ]);

        $version = ProjectVersion::find($versionId);
        if (!$version) {
            return response()->json(['message' => 'Version not found'], 404);
        }

        $project = Project::find($version->project_id);
        if (!$project) {
            return response()->json(['message' => 'Project not found'], 404);
        }

        $user = $request->user();
        $isAdmin = $user->role?->name === 'admin';
        $isOwnerProject = $project->user_id === $user->id;
        $isSupervisor = $project->supervisor_id === $user->id;
        $isOwnerVersion = $version->user_id === $user->id;

        if (!($isAdmin || $isOwnerProject || $isSupervisor || $isOwnerVersion)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($request->hasFile('file')) {
            if ($version->file_path && Storage::disk('public')->exists($version->file_path)) {
                Storage::disk('public')->delete($version->file_path);
            }
            $version->file_path = $request->file('file')->store('versions', 'public');
        }

        $version->version_title = $request->version_title;
        $version->version_description = $request->version_description;
        $version->save();

        return response()->json([
            'message' => 'Version updated successfully',
            'version' => $version->load('user:id,name'),
        ]);
    }

    // حذف إصدار
    public function delete(Request $request, $versionId)
    {
        $version = ProjectVersion::find($versionId);
        if (!$version) {
            return response()->json(['message' => 'Version not found'], 404);
        }

        $project = Project::find($version->project_id);
        if (!$project) {
            return response()->json(['message' => 'Project not found'], 404);
        }

        $user = $request->user();
        if (!$user) return response()->json(['message' => 'Unauthenticated'], 401);

        $isAdmin = $user->role?->name === 'admin';
        $isOwnerProject = $project->user_id === $user->id;
        $isSupervisor = $project->supervisor_id === $user->id;
        $isOwnerVersion = $version->user_id === $user->id;

        if (!($isAdmin || $isOwnerProject || $isSupervisor || $isOwnerVersion)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($version->file_path && Storage::disk('public')->exists($version->file_path)) {
            Storage::disk('public')->delete($version->file_path);
        }

        $version->delete();

        return response()->json(['message' => 'Version deleted successfully']);
    }

    // ✅ Timeline
    public function timeline(Request $request, $projectId)
    {
        $project = Project::find($projectId);
        if (!$project) return response()->json(['message' => 'Project not found'], 404);

        if (!$this->canAccessProject($request, $project)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $versions = ProjectVersion::where('project_id', $projectId)
            ->with('user:id,name')
            ->orderBy('created_at', 'desc')
            ->get();

        $timeline = $versions
            ->groupBy(fn ($v) => Carbon::parse($v->created_at)->format('F Y'))
            ->map(function ($items, $month) {
                return [
                    'month' => $month,
                    'versions' => $items->map(fn ($v) => [
                        'id' => $v->id,
                        'version_title' => $v->version_title,
                        'version_description' => $v->version_description,
                        'file_url' => $v->file_path ? asset('storage/' . $v->file_path) : null,
                        'uploaded_by' => $v->user?->name,
                        'created_at' => Carbon::parse($v->created_at)->format('Y-m-d H:i'),
                    ])->values()
                ];
            })
            ->values();

        return response()->json([
            'project_id' => $projectId,
            'timeline' => $timeline
        ]);
    }
}

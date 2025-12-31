<?php

namespace App\Http\Controllers;

use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StudentDirectoryController extends Controller
{
    private function canAccess(Request $request, Project $project): bool
    {
        $u = $request->user();
        if (!$u) return false;

        $role = $u->role?->name ?? $u->role;

        return $role === 'admin'
            || $project->user_id === $u->id
            || $project->supervisor_id === $u->id
            || DB::table('project_members')
                ->where('project_id', $project->id)
                ->where('student_id', $u->id)
                ->exists();
    }

    // ✅ أعضاء المشروع (المالك + الأعضاء)
    public function studentsForProject(Request $request, $id)
    {
        $project = Project::find($id);
        if (!$project) return response()->json(['message' => 'Project not found'], 404);

        if (!$this->canAccess($request, $project)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $owner = DB::table('users')
            ->select('id', 'name', 'email')
            ->where('id', $project->user_id)
            ->first();

        $members = DB::table('project_members as pm')
            ->join('users as u', 'u.id', '=', 'pm.student_id')
            ->where('pm.project_id', $project->id)
            ->select('u.id', 'u.name', 'u.email')
            ->orderBy('u.name')
            ->get();

        return response()->json([
            'project_id' => $project->id,
            'owner' => $owner,
            'members' => $members,
        ]);
    }
    
}

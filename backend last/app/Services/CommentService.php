<?php

namespace App\Services;

use App\Models\Comment;
use App\Repositories\CommentRepository;
use Illuminate\Http\Request;

class CommentService
{
    protected $comments;

    public function __construct(CommentRepository $comments)
    {
        $this->comments = $comments;
    }

    /* =======================
        CREATE
    ======================= */

    public function addToProject(Request $request, $projectId)
    {
        return $this->comments->create([
            'content'    => $request->comment,
            'user_id'    => $request->user()->id,
            'project_id' => $projectId,
            'task_id'    => null,
        ]);
    }

    public function addToTask(Request $request, $taskId)
    {
        return $this->comments->create([
            'content'    => $request->comment,
            'user_id'    => $request->user()->id,
            'task_id'    => $taskId,
            'project_id'=> null,
        ]);
    }

    /* =======================
        UPDATE
    ======================= */

    public function update(Request $request, Comment $comment)
    {
        return $this->comments->update($comment, [
            'content' => $request->comment
        ]);
    }

    /* =======================
        DELETE
    ======================= */

    public function delete(Comment $comment)
    {
        return $this->comments->delete($comment);
    }
}

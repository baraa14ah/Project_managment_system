<?php

namespace App\Http\Controllers;

use App\Services\NotificationService;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function __construct(private NotificationService $service) {}

    public function index(Request $request)
    {
        $user = $request->user();
        $payload = $this->service->getAll($user->id);
        return response()->json($payload);
    }

    public function unread(Request $request)
    {
        $user = $request->user();
        $payload = $this->service->getUnread($user->id);
        return response()->json($payload);
    }

    public function markAsRead(Request $request, $id)
    {
        $user = $request->user();
        $result = $this->service->markAsRead((string)$id, $user->id);

        if (isset($result['status']) && $result['status'] === 404) {
            return response()->json(['message' => $result['error']], 404);
        }

        return response()->json($result);
    }

    public function markAllAsRead(Request $request)
    {
        $user = $request->user();
        return response()->json($this->service->markAllAsRead($user->id));
    }

    public function delete(Request $request, $id)
    {
        $user = $request->user();
        $result = $this->service->delete((string)$id, $user->id);

        if (isset($result['status']) && $result['status'] === 404) {
            return response()->json(['message' => $result['error']], 404);
        }

        return response()->json($result);
    }

    public function deleteAll(Request $request)
    {
        $user = $request->user();
        return response()->json($this->service->deleteAll($user->id));
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;

class CategoryController extends Controller
{
    public function index()
    {
        return Category::withCount('videos')->get();
    }

    public function show(string $id)
    {
        return Category::with('videos')->findOrFail($id);
    }
}

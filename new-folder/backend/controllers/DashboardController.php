<?php
require_once __DIR__ . '/../../core/Controller.php';

class DashboardController extends Controller
{
    public function index()
    {
        // In a real app you would fetch stats from DB here.
        // For now we just render the view; the view will populate zero values.
        $this->render('dashboard');
    }
}
?>
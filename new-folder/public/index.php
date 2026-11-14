<?php
spl_autoload_register(function ($class) {
    // Convert namespace to file path
    $file = __DIR__ . '/' . str_replace('\\', '/', $class) . '.php';
    if (file_exists($file)) {
        require $file;
    }
});

require __DIR__ . '/core/Router.php';
require __DIR__ . '/core/Controller.php';

$router = new Router();

// Public routes
$router->get('', 'AuthController@login');
$router->get('login', 'AuthController@login');
$router->post('login', 'AuthController@processLogin');
$router->get('register', 'AuthController@register');

// Add more routes as needed (e.g., dashboard, QR generation)

$router->run();
?>
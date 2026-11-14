<?php
class Router {
    private $routes = [];

    public function get(string $uri, string $action) {
        $this->routes['GET'][trim($uri, '/')] = $action;
    }

    public function post(string $uri, string $action) {
        $this->routes['POST'][trim($uri, '/')] = $action;
    }

    public function run() {
        $method = $_SERVER['REQUEST_METHOD'];
        $uri = trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');
        $action = $this->routes[$method][$uri] ?? null;
        if (!$action) {
            http_response_code(404);
            echo "404 Not Found";
            exit;
        }
        // Expected format: Controller@method
        [$controller, $methodName] = explode('@', $action);
        $controllerClass = "App\\Controllers\\{$controller}";
        if (!class_exists($controllerClass)) {
            http_response_code(500);
            echo "Controller {$controllerClass} not found";
            exit;
        }
        $instance = new $controllerClass();
        if (!method_exists($instance, $methodName)) {
            http_response_code(500);
            echo "Method {$methodName} not found in {$controllerClass}";
            exit;
        }
        $instance->$methodName();
    }
}
?>
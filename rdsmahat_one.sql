-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Jul 17, 2026 at 10:01 PM
-- Server version: 11.4.12-MariaDB-cll-lve
-- PHP Version: 8.4.22

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `rdsmahat_one`
--

-- --------------------------------------------------------

--
-- Table structure for table `api_usage_logs`
--

CREATE TABLE `api_usage_logs` (
  `id` varchar(36) NOT NULL,
  `unified_key_id` varchar(36) DEFAULT NULL,
  `provider_id` varchar(36) DEFAULT NULL,
  `provider_key_id` varchar(36) DEFAULT NULL,
  `model_name` varchar(255) DEFAULT NULL,
  `request_path` varchar(255) DEFAULT NULL,
  `status` varchar(50) NOT NULL,
  `status_code` int(11) DEFAULT NULL,
  `error_message` text DEFAULT NULL,
  `response_time_ms` int(11) DEFAULT NULL,
  `tokens_used` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `api_usage_logs`
--

INSERT INTO `api_usage_logs` (`id`, `unified_key_id`, `provider_id`, `provider_key_id`, `model_name`, `request_path`, `status`, `status_code`, `error_message`, `response_time_ms`, `tokens_used`, `created_at`) VALUES
('099ade7f-184a-4c87-a122-76e851e3b787', '330c2425-3a81-44bd-9f8f-0af3c9e0c558', '1ff27993-b1c4-4732-ad46-3db3c7921750', '4758e078-c652-4e3e-96d7-7d1e5b8ab21a', 'gemini-2.5-flash', '/v1/chat/completions', 'error', 400, 'Request failed with status code 400', 342, 0, '2026-07-17 16:53:10'),
('0ebb335e-5f72-4518-9ff0-c2ff09d76a1e', '330c2425-3a81-44bd-9f8f-0af3c9e0c558', '1ff27993-b1c4-4732-ad46-3db3c7921750', '02918da9-70b6-4023-ac8e-cab368a85771', 'gemini-2.5-flash', '/v1/chat/completions', 'error', 403, 'Request failed with status code 403', 528, 0, '2026-07-17 16:53:09'),
('24c5cccb-957c-4e11-9523-7917f3ba5d6c', '330c2425-3a81-44bd-9f8f-0af3c9e0c558', '1ff27993-b1c4-4732-ad46-3db3c7921750', 'd0eb613e-54b1-4647-8afc-399f65f31387', 'gemini-2.5-flash', '/v1/chat/completions', 'success', 200, NULL, 2000, 791, '2026-07-17 16:53:13'),
('3bf81b89-140a-4ede-81b4-a303629c3b44', '330c2425-3a81-44bd-9f8f-0af3c9e0c558', '1ff27993-b1c4-4732-ad46-3db3c7921750', '0c2f2d85-c2dd-4c1f-9b79-12111cf66b4e', 'gemini-2.5-flash', '/v1/chat/completions', 'error', 403, 'Request failed with status code 403', 986, 0, '2026-07-17 16:52:52'),
('7ba8fef8-91e7-4716-8e4f-a93591c45a85', '330c2425-3a81-44bd-9f8f-0af3c9e0c558', '1ff27993-b1c4-4732-ad46-3db3c7921750', 'fd02b977-de36-4292-a0a0-001087fff749', 'gemini-2.5-flash', '/v1/chat/completions', 'error', 403, 'Request failed with status code 403', 518, 0, '2026-07-17 16:53:11'),
('823494af-492b-4f48-a92e-edc3db9ed455', '330c2425-3a81-44bd-9f8f-0af3c9e0c558', '1ff27993-b1c4-4732-ad46-3db3c7921750', '7686952c-86ca-490c-8b51-1891af79cbec', 'gemini-2.5-flash', '/v1/chat/completions', 'error', 403, 'Request failed with status code 403', 1315, 0, '2026-07-17 16:53:08'),
('abe83c82-7698-4b68-bd61-e24a9e0b2d82', '330c2425-3a81-44bd-9f8f-0af3c9e0c558', '1ff27993-b1c4-4732-ad46-3db3c7921750', 'dd620a86-5196-4400-8286-35d8f2fce2fd', 'gemini-2.5-flash', '/v1/chat/completions', 'error', 403, 'Request failed with status code 403', 344, 0, '2026-07-17 16:53:10'),
('c2396b52-e74b-4678-a162-362ad54ba368', '330c2425-3a81-44bd-9f8f-0af3c9e0c558', '1ff27993-b1c4-4732-ad46-3db3c7921750', 'bcb68473-ec4c-449b-975a-ab2a38374c61', 'gemini-2.5-flash', '/v1/chat/completions', 'error', 403, 'Request failed with status code 403', 515, 0, '2026-07-17 16:53:11'),
('e0bbdddd-c562-42f0-bb01-30081d0c09a8', '330c2425-3a81-44bd-9f8f-0af3c9e0c558', '1ff27993-b1c4-4732-ad46-3db3c7921750', 'cdf1ba7b-cfac-42ce-bea3-20b90f3b7c81', 'gemini-2.5-flash', '/v1/chat/completions', 'error', 403, 'Request failed with status code 403', 499, 0, '2026-07-17 16:53:09'),
('f1d16970-88e8-4b55-9fb1-a0973adcc12c', '330c2425-3a81-44bd-9f8f-0af3c9e0c558', '1ff27993-b1c4-4732-ad46-3db3c7921750', 'd0eb613e-54b1-4647-8afc-399f65f31387', 'gemini-2.5-flash', '/v1/chat/completions', 'success', 200, NULL, 1828, 711, '2026-07-17 16:52:53');

-- --------------------------------------------------------

--
-- Table structure for table `providers`
--

CREATE TABLE `providers` (
  `id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `base_url` varchar(255) NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `priority` int(11) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `providers`
--

INSERT INTO `providers` (`id`, `name`, `base_url`, `is_active`, `priority`, `created_at`, `updated_at`) VALUES
('1ff27993-b1c4-4732-ad46-3db3c7921750', 'Google', 'https://generativelanguage.googleapis.com/v1beta', 1, 61, '2026-02-03 23:51:32', '2026-02-13 11:39:04'),
('5afea3eb-3686-45b8-a556-2d207b20053d', 'Replicate', 'https://api.replicate.com/v1', 1, 0, '2026-02-04 02:06:48', '2026-02-04 02:06:48'),
('d5165497-70e1-40dd-9619-693e32680f23', 'Groq', 'https://api.groq.com/openai/v1', 1, 90, '2026-02-03 23:51:32', '2026-02-03 23:51:32');

-- --------------------------------------------------------

--
-- Table structure for table `provider_api_keys`
--

CREATE TABLE `provider_api_keys` (
  `id` varchar(36) NOT NULL,
  `provider_id` varchar(36) NOT NULL,
  `model_id` varchar(36) DEFAULT NULL,
  `api_key` text NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `priority` int(11) DEFAULT 0,
  `total_requests` int(11) DEFAULT 0,
  `failed_requests` int(11) DEFAULT 0,
  `last_used_at` datetime DEFAULT NULL,
  `last_error` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `provider_api_keys`
--

INSERT INTO `provider_api_keys` (`id`, `provider_id`, `model_id`, `api_key`, `name`, `is_active`, `priority`, `total_requests`, `failed_requests`, `last_used_at`, `last_error`, `created_at`, `updated_at`) VALUES
('02918da9-70b6-4023-ac8e-cab368a85771', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyBviHu7_Iz3Uk7rVxQwCkLx2uXvljuUQDM', NULL, 1, 87, 69, 41, NULL, 'Request failed with status code 403', '2026-02-04 00:00:56', '2026-07-17 16:53:09'),
('04b2014f-33b2-450b-b6b1-98ef163b896b', 'd5165497-70e1-40dd-9619-693e32680f23', NULL, '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', NULL, 1, 10, 0, 1, NULL, 'Request failed with status code 400', '2026-02-03 23:59:19', '2026-02-16 12:47:28'),
('0517917a-2887-4991-b577-752a932452d0', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyBmOaJSkVOtI5e4L0aoEMpGDXoVk_mLyWc', NULL, 1, 6, 37, 24, NULL, 'Request failed with status code 429', '2026-02-04 00:22:41', '2026-03-28 12:46:42'),
('06bfdf15-3796-4595-bc42-55f642992e0a', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyD39c0Qvc1xfMkL6xcjItEkGk_BCV__gPU', NULL, 1, 34, 45, 26, NULL, 'Request failed with status code 429', '2026-02-04 00:22:04', '2026-03-28 12:46:31'),
('078c39db-6970-48d4-9cab-61e7cac72580', 'd5165497-70e1-40dd-9619-693e32680f23', NULL, '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', NULL, 1, 12, 4, 1, NULL, 'Request failed with status code 404', '2026-02-03 23:59:20', '2026-02-16 12:47:28'),
('08fe7042-58dc-4f0b-acfa-cd6268e37ad2', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyDc_Voqs2qqEuGVNM1mVqZHj8IXj4T4OJA', NULL, 1, 54, 46, 26, NULL, 'Request failed with status code 429', '2026-02-04 00:59:54', '2026-03-28 12:46:23'),
('0a31cd72-7363-4205-836c-e06e87a3825c', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyBui2n8ZlOCdiLccjQ_nZ90jNZFAjdvlGE', NULL, 1, 64, 4, 23, NULL, 'Request failed with status code 429', '2026-02-04 00:25:41', '2026-03-28 12:46:19'),
('0c2f2d85-c2dd-4c1f-9b79-12111cf66b4e', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyDXjhZ1qdR_ONnsg2dxyREa_y7ci6lm154', NULL, 1, 87, 40, 21, NULL, 'Request failed with status code 403', '2026-02-04 00:00:56', '2026-07-17 16:52:52'),
('0e6eff69-899f-4963-a445-6376f005c791', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyDsWq3jMinzM1Z8a7i7TBuQI8yTJGBVrXo', NULL, 1, 13, 38, 14, NULL, 'Request failed with status code 429', '2026-02-04 00:13:04', '2026-03-28 12:46:39'),
('108799b8-a0d5-4641-afb5-755c817460f9', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyDKdPDYxdYsg1A013Gykfz0yCqWE-iWjxw', NULL, 1, 70, 35, 17, NULL, 'Request failed with status code 429', '2026-02-04 01:09:26', '2026-03-28 12:46:17'),
('1104b82e-e48a-4fd3-aa20-9f19366f8ca4', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyA3q2GPTEq0i1iZ1uQybVraAOxOyRV4wDY', NULL, 1, 65, 136, 115, NULL, 'Request failed with status code 429', '2026-02-04 00:17:00', '2026-03-28 12:46:19'),
('11936430-7434-4f12-bf62-322feef4d1bf', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyDMgTsKU5Ka3hzYJ_x8fIpaijy-2RCVsxI', NULL, 1, 9, 34, 15, NULL, 'Request failed with status code 429', '2026-02-04 00:00:55', '2026-03-28 12:46:40'),
('126780c0-b822-45ad-8469-e2e51028805b', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyCPh1RN_WkdKs3ufjkX_nUYimEjKv1ZXzI', NULL, 1, 41, 29, 11, NULL, 'Request failed with status code 400', '2026-02-04 00:05:05', '2026-03-28 12:46:28'),
('14275d2b-19b9-4f82-9b15-d648f6e7ecb8', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyCFxHQxAZ7MOL6Bijf4u4QIOKCV2jBPOyw', NULL, 1, 3, 38, 16, NULL, 'Request failed with status code 429', '2026-02-04 00:11:23', '2026-03-28 12:46:43'),
('14f7fd96-5f29-4123-a3cf-b38d901ce44d', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyD_BiiovNO88DxsExUmCRP9ULxT_-XM4MM', NULL, 1, 0, 9, 14, NULL, 'Request failed with status code 429', '2026-02-04 01:10:04', '2026-03-28 12:46:44'),
('152827f0-ef6c-46b9-a08f-d0c405134cc1', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyDB7q-Ueu_0c9uuA-qWVLYAXPQXgJJcc2A', NULL, 1, 88, 9, 10, NULL, 'Request failed with status code 503', '2026-02-04 01:14:27', '2026-04-22 15:03:08'),
('17f30408-e4b2-4052-987d-7dc359d1d021', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyAzhNXs5YjoGkzNRBxDm-d5X-EkAlfWWoQ', NULL, 1, 7, 2, 10, NULL, 'Request failed with status code 429', '2026-02-04 00:26:28', '2026-03-28 12:46:41'),
('1a8c2339-3269-407d-84f5-67b53be6ed83', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyAsPhbcV0LmuzJRI4FDaDnlCzntObEwGQY', NULL, 1, 46, 3, 8, NULL, 'Request failed with status code 429', '2026-02-04 00:52:14', '2026-03-28 12:46:27'),
('1e1d9f1d-03a2-414e-abe2-eeb2aec246d8', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyCFtI3fLjVFI5ifA0ICERAGJ_3OC5V7nfo', NULL, 1, 80, 1, 15, NULL, 'Request failed with status code 429', '2026-02-04 00:45:33', '2026-03-28 12:46:13'),
('2ba4bfbb-bbea-4bda-ac92-07e1a0b84340', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyC357ZXS2Q-3XJKlbRMIny5hu1eRL3EiZE', NULL, 1, 28, 7, 10, NULL, 'Request failed with status code 429', '2026-02-04 00:21:22', '2026-03-28 12:46:33'),
('2c26240f-e8a3-4beb-aba1-8fee56035879', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyBARH-Gmb81J3OyiR3PUYIKh4PXI1uZru0', NULL, 1, 86, 3, 9, NULL, 'Request failed with status code 429', '2026-02-04 01:04:43', '2026-03-28 12:46:11'),
('2e54f62a-82bf-4291-9797-8a3e1cc13b29', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyAcU7RoIFxhofic1FNMgl-outzBBe_dpIo', NULL, 1, 11, 14, 41, NULL, 'Request failed with status code 429', '2026-02-04 00:00:57', '2026-03-28 12:46:40'),
('2fc9c044-3f49-4b98-a74d-44d9f34f32d3', 'd5165497-70e1-40dd-9619-693e32680f23', NULL, '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', NULL, 1, 2, 0, 2, NULL, 'Request failed with status code 404', '2026-02-03 23:59:20', '2026-02-16 12:47:25'),
('30b67a69-1920-4754-99c6-c5cdf2787ff7', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyCESIcN8KFcVknBqlae7EnrxSHNpDcofGM', NULL, 1, 57, 7, 9, NULL, 'Request failed with status code 429', '2026-02-04 00:54:57', '2026-03-28 12:46:22'),
('32bc0a2f-dd4f-4002-943b-41d0b170cb9a', 'd5165497-70e1-40dd-9619-693e32680f23', NULL, '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', NULL, 1, 7, 0, 1, NULL, 'Request failed with status code 400', '2026-02-03 23:59:18', '2026-02-16 12:47:25'),
('33becf42-1f04-43a7-bf92-93b1699e4922', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyDEP6X_qWSZoti831zm6n5VfPX0ZzAgv90', NULL, 1, 23, 4, 11, NULL, 'Request failed with status code 429', '2026-02-04 00:19:57', '2026-03-28 12:46:36'),
('33d30c34-97bd-4fff-bdeb-47a6440a393a', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyBEan0CO5KB5qIF58Zqge-xi_P21Cx2P2s', NULL, 1, 49, 1, 16, NULL, 'Request failed with status code 429', '2026-02-04 00:26:05', '2026-03-28 12:46:25'),
('3633251a-c43e-461f-b74e-731a19c3a07d', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyCPhtx21aCptX8Ecu__jeMWsNmqvbObpSs', NULL, 1, 10, 0, 15, NULL, 'Request failed with status code 429', '2026-02-04 00:00:55', '2026-03-28 12:46:40'),
('3ada918b-0ef9-424a-bd7a-c8572ee7ebc6', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyDFl7WOBI1pruiuIXSEPbWIzVDhl0I1Ykk', NULL, 1, 15, 1, 13, NULL, 'Request failed with status code 429', '2026-02-04 00:59:00', '2026-03-28 12:46:38'),
('3d5d97c7-fa6f-493f-8a2e-64507fff32f5', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyAMaHxFHZH7XeUjQqf1V0XMwCk4CyWoPRs', NULL, 1, 55, 5, 11, NULL, 'Request failed with status code 429', '2026-02-04 00:47:48', '2026-03-28 12:46:22'),
('42a1e0b1-e54a-474a-8a19-eb0a27f353e8', 'd5165497-70e1-40dd-9619-693e32680f23', NULL, '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', NULL, 1, 6, 0, 1, NULL, 'Request failed with status code 404', '2026-02-03 23:59:18', '2026-02-16 12:47:25'),
('460e34ec-84d3-4cdd-bd64-5e35cfb71c47', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyBvn43lXcCDbMtuLYBJbjlufOi8S8yd_ew', NULL, 1, 51, 3, 11, NULL, 'Request failed with status code 429', '2026-02-04 00:53:00', '2026-03-28 12:46:24'),
('4758e078-c652-4e3e-96d7-7d1e5b8ab21a', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyBfaTGXH3AM1tbiCAea22rYjJHmYCD6B-I', NULL, 1, 87, 3, 20, NULL, 'Request failed with status code 400', '2026-02-04 00:04:55', '2026-07-17 16:53:10'),
('4a02734f-fd00-455c-919a-f504e0a879d7', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyBt_Ebc42CXjquBideJ2YCgd9qJgE4hZJk', NULL, 1, 61, 2, 11, NULL, 'Request failed with status code 429', '2026-02-04 00:18:25', '2026-03-28 12:46:20'),
('4c9c5330-0440-4c90-b445-72b03fb77309', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyAq5ScyHRObpjzgvBsE3AN3smtxdYSUd38', NULL, 1, 69, 5, 12, NULL, 'Request failed with status code 429', '2026-02-04 01:10:33', '2026-03-28 12:46:17'),
('4cdeea93-ae28-425d-b663-ca2993d2de54', 'd5165497-70e1-40dd-9619-693e32680f23', NULL, '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', NULL, 1, 5, 0, 1, NULL, 'Request failed with status code 400', '2026-02-03 23:59:18', '2026-02-16 12:47:25'),
('4df233d1-4990-4994-88fa-4b79c7c578e8', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyAF_bNOGzJxUpk0zL9jKVJtwUYVHk9wglA', NULL, 1, 79, 7, 14, NULL, 'Request failed with status code 429', '2026-02-04 00:00:56', '2026-03-28 12:46:14'),
('561708ec-4b66-4ec4-bf38-dae1e700c8c6', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyBiXQAIMsa5lWsb1NdtA6EtZl15p9MNYDI', NULL, 1, 88, 1, 22, NULL, 'Request failed with status code 403', '2026-02-04 00:46:04', '2026-04-22 13:18:29'),
('56303bec-e58a-4766-a9c2-bf888d8981d6', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyBo48c_z-U2wsNgpj6W9Hf-WHpADKJRjC8', NULL, 1, 31, 0, 20, NULL, 'Request failed with status code 429', '2026-02-04 00:00:55', '2026-03-28 12:46:32'),
('5a0c376b-163a-4aee-975b-288ae5a5177b', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyAxjY-TeF-atpw4CiD98HQlHLnEHfFnwDk', NULL, 1, 66, 3, 11, NULL, 'Request failed with status code 429', '2026-02-04 00:21:30', '2026-03-28 12:46:18'),
('5bf0fcfe-c6d8-4bf7-aa0d-74cd2a4a2e11', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyCulL3wmGw5IN5IyJjF--8SPRQop75mblI', NULL, 1, 85, 5, 14, NULL, 'Request failed with status code 429', '2026-02-04 00:58:27', '2026-03-28 12:46:12'),
('5c4c0d27-0980-4ab1-9480-9f314444e161', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyDyStV3Ollvq9DHLfTI0WWj9wjg21rWwGk', NULL, 1, 2, 4, 8, NULL, 'Request failed with status code 429', '2026-02-04 00:21:38', '2026-03-28 12:46:43'),
('61e5beca-38e8-46fc-833c-5f7384124c89', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyDZ5d0-J2NaUEX7Lr8qfbL8oRxpW3umDKQ', NULL, 1, 12, 0, 18, NULL, 'Request failed with status code 429', '2026-02-04 00:51:11', '2026-03-28 12:46:39'),
('6343174f-5c63-4025-a80f-3a1933c4b708', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyC-VfEHy5Vn4rH1A0sHlnWVoMGx945hFCk', NULL, 1, 40, 5, 8, NULL, 'Request failed with status code 429', '2026-02-04 00:51:42', '2026-03-28 12:46:29'),
('6353433e-80c7-4e83-8eb6-6084c2494276', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyBwraU1KDzkeB9PwpYCM_SWCLaFgwMgjW0', NULL, 1, 76, 5, 11, NULL, 'Request failed with status code 429', '2026-02-04 01:08:05', '2026-03-28 12:46:15'),
('673b9589-fccd-4d7c-89cb-90f01c108b57', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyC0M0qkz966HKaLvmF2IMV2ID8CQsyv1xI', NULL, 1, 24, 6, 13, NULL, 'Request failed with status code 429', '2026-02-04 01:00:19', '2026-03-28 12:46:34'),
('682f0bc7-717b-4b57-82a5-20d27d7d567f', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyDVua5u-0uAbkpsVyJ8z_rvXuena6hziE8', NULL, 1, 35, 3, 10, NULL, 'Request failed with status code 429', '2026-02-04 00:57:34', '2026-03-28 12:46:30'),
('69cf51c3-fb28-448e-b045-b4b2cc38113d', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyArColEoe6QcYTTmM-UG7lnzwftc5We0Wo', NULL, 1, 30, 3, 10, NULL, 'Request failed with status code 429', '2026-02-04 00:59:25', '2026-03-28 12:46:32'),
('6c9358f6-1a1f-445f-8544-af1469687b3e', 'd5165497-70e1-40dd-9619-693e32680f23', NULL, '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', NULL, 1, 8, 0, 1, NULL, 'Request failed with status code 400', '2026-02-03 23:59:18', '2026-02-16 12:47:25'),
('6dc2744f-17c4-49df-a8ba-90d8187acf6d', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyAgkKh9K21HG01ogDhHtYx7a34LmgeaVo8', NULL, 1, 56, 2, 13, NULL, 'Request failed with status code 429', '2026-02-04 01:03:31', '2026-03-28 12:46:22'),
('6e2efc57-5e60-41af-8f19-6734cbe435a5', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyDPJqZ7Cz-czfXktbMwaHaFk8obfNEA5EM', NULL, 1, 81, 5, 11, NULL, 'Request failed with status code 429', '2026-02-04 00:16:30', '2026-03-28 12:46:13'),
('731712a4-1f45-4336-9ecc-87dea4fac8f9', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyDTH-xCV5-wV182uyhJtrd3WwOf_J1k7kg', NULL, 1, 38, 5, 10, NULL, 'Request failed with status code 429', '2026-02-04 00:54:32', '2026-03-28 12:46:29'),
('757f0911-75db-4115-8b45-a1588511f10c', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyDjdYZljVaELH0_vaDNjCdMND9XBD0gdzU', NULL, 1, 74, 4, 11, NULL, 'Request failed with status code 400', '2026-02-04 00:01:38', '2026-03-28 12:46:16'),
('7686952c-86ca-490c-8b51-1891af79cbec', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyASYE0PNUI2dUGubugdecfHRxHO3R3wdPc', NULL, 1, 87, 4, 15, NULL, 'Request failed with status code 403', '2026-02-04 01:02:01', '2026-07-17 16:53:08'),
('79444ccb-1999-436d-b23e-750ee927d368', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyCRI1boEcGI-MAWyxqsaPsPJ5MSxPtpFTI', NULL, 1, 33, 5, 10, NULL, 'Request failed with status code 429', '2026-02-04 00:52:39', '2026-03-28 12:46:31'),
('79a2bae8-1e1c-49ac-9efd-1a3d0dfff940', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyAt7gCQw5BxLckhKg1bibl4uzFdmwl2VaE', NULL, 1, 45, 8, 12, NULL, 'Request failed with status code 429', '2026-02-04 01:13:57', '2026-03-28 12:46:27'),
('7b2c6926-4757-4953-9ece-ae376d17306e', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyBfwiZEBfjekJLmDF5YZSEzq0OdohJtbrY', NULL, 1, 19, 5, 10, NULL, 'Request failed with status code 429', '2026-02-04 01:12:34', '2026-03-28 12:46:37'),
('7d7eeab3-a23a-4910-ada2-96b9d4a7141d', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyDqUTkSyS3FsUFJOk8L-EchtInDmnaazy8', NULL, 1, 47, 4, 10, NULL, 'Request failed with status code 429', '2026-02-04 01:07:37', '2026-03-28 12:46:26'),
('7f084997-ec2a-4bbd-8e2d-bf20012bc4fe', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyALTeJ2lONDWCXCApBWWiDXwaBy8yAx-S4', NULL, 1, 27, 0, 13, NULL, 'Request failed with status code 429', '2026-02-04 00:00:57', '2026-03-28 12:46:33'),
('8130d77c-2214-4c46-8bf5-b1be2b495c35', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyC61GBQgMsE7Koaq4g4Oe-EwFmS66zFcQ8', NULL, 1, 4, 5, 11, NULL, 'Request failed with status code 429', '2026-02-04 00:12:20', '2026-03-28 12:46:42'),
('82c10b24-b171-4281-bff8-3159ee1e50ac', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyCf6b1RMav-ckcAmRZtqf5tHKzhJ1J_iC0', NULL, 1, 83, 3, 11, NULL, 'Request failed with status code 429', '2026-02-04 00:47:16', '2026-03-28 12:46:12'),
('8591887c-b624-4dd3-8ad9-9761e8a6c46e', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyB4f4q_IJ1BLR0hl6qzYOA2o2gfzmDPMi8', NULL, 1, 36, 1, 10, NULL, 'Request failed with status code 429', '2026-02-04 00:00:55', '2026-03-28 12:46:30'),
('874b17bf-8184-41a6-a6b3-1f08e8247641', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyDhdmgMVdqIYPolQTQADdvi9C0oJ6fVwbQ', NULL, 1, 63, 6, 11, NULL, 'Request failed with status code 429', '2026-02-04 00:23:14', '2026-03-28 12:46:20'),
('896a7c6c-0487-4683-963e-54814dcb4e9a', 'd5165497-70e1-40dd-9619-693e32680f23', NULL, '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', NULL, 1, 1, 0, 1, NULL, 'Request failed with status code 404', '2026-02-03 23:59:18', '2026-02-16 12:47:25'),
('8d2f69b6-27b9-4da5-a596-961e35013a7e', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyAqolAHNqPKftdnrabdjEoMZ1P4OQ8LZzQ', NULL, 1, 60, 1, 11, NULL, 'Request failed with status code 429', '2026-02-04 00:45:09', '2026-03-28 12:46:21'),
('902c4c48-ab7e-44fb-bd4a-26d5492e3523', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyD6Kc6cdlP0w0BlYC6iNehd5lHfMqIjg6Q', NULL, 1, 67, 4, 11, NULL, 'Request failed with status code 429', '2026-02-04 00:17:53', '2026-03-28 12:46:18'),
('91858746-e247-43c5-baef-9abdccef944e', 'd5165497-70e1-40dd-9619-693e32680f23', NULL, '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', NULL, 1, 9, 0, 1, NULL, 'Request failed with status code 404', '2026-02-03 23:59:19', '2026-02-16 12:47:25'),
('97570d37-53f7-4990-b319-2928848f9395', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyD2RlWoitrNdouD4smXbGh2ezqya-SzXgE', NULL, 1, 82, 3, 10, NULL, 'Request failed with status code 429', '2026-02-04 00:10:59', '2026-03-28 12:46:13'),
('98e5864d-f275-48b9-a62e-7489546086cc', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyAwXEZbi5A6X46HxhN4NRO1K21azsJ2jxk', NULL, 1, 21, 2, 8, NULL, 'Request failed with status code 429', '2026-02-04 01:05:56', '2026-03-28 12:46:36'),
('9a1a40d6-6cb2-467f-a427-40ce5e5b9b37', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyAEF0NioxRoAQBwy3l4jSubey_IYxhZIk0', NULL, 1, 62, 5, 14, NULL, 'Request failed with status code 429', '2026-02-04 01:07:01', '2026-03-28 12:46:20'),
('9b4e0014-30e1-42d8-b49f-3c36aa84abfc', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyD5JzXgeA0zywr1JYVpVJHWc2Jt1UwvGb4', NULL, 1, 25, 1, 18, NULL, 'Request failed with status code 429', '2026-02-04 00:00:57', '2026-03-28 12:46:34'),
('9c236bb9-fc98-42bc-b603-02dc5be91159', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyCjH_lthBEWDWgVOfrF_6H11MgMCj9sH94', NULL, 1, 8, 6, 12, NULL, 'Request failed with status code 429', '2026-02-04 01:15:22', '2026-03-28 12:46:41'),
('9e1f8a11-d697-4e2b-94d8-5d09a0785824', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyCnYvnDevvRYhZ1vbUx7BpZgIuV1nf_4Lg', NULL, 1, 44, 1, 12, NULL, 'Request failed with status code 429', '2026-02-04 00:00:55', '2026-03-28 12:46:27'),
('a3e83098-ef5a-45a6-a6ee-e1d6f2c3d8cb', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyDVnWJfRlT8sfgp35u1-LR6fIGSrgeFqcM', NULL, 1, 73, 1, 18, NULL, 'Request failed with status code 429', '2026-02-04 00:26:58', '2026-03-28 12:46:16'),
('a4ece2e4-82bf-4cb1-86c3-f7b7be5a3d3e', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyAp0iPDDYZBb9yHeHOtceAO2y32x6H0Knw', NULL, 1, 26, 7, 9, NULL, 'Request failed with status code 429', '2026-02-04 00:00:57', '2026-03-28 12:46:34'),
('a7ed7bda-9fb9-4c31-9e7e-e2b5beae0d4c', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyCuer_TGpQPBaTpjUkDswVtPFtsr8VuPxc', NULL, 1, 68, 4, 10, NULL, 'Request failed with status code 400', '2026-02-04 00:04:40', '2026-03-28 12:46:18'),
('af129203-088f-41aa-96c4-dba543a7c93c', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyCND6_1r48P52hOwuxZMyxnBx_2hbIsfOw', NULL, 1, 39, 6, 11, NULL, 'Request failed with status code 429', '2026-02-04 00:54:02', '2026-03-28 12:46:29'),
('af633af1-35ef-4260-bb3c-70a046f5cb19', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyC23WOL5X8nJcPW_-ccavMSsw_Aax8F0BI', NULL, 1, 37, 3, 10, NULL, 'Request failed with status code 429', '2026-02-04 01:05:09', '2026-03-28 12:46:30'),
('bb8cca6e-dfa9-4126-b129-93c66a4567b5', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyCm1BxwPAJ9IlGh_WJmpSTukdkn3ARAyn8', NULL, 1, 52, 3, 11, NULL, 'Request failed with status code 429', '2026-02-04 01:00:49', '2026-03-28 12:46:23'),
('bcb68473-ec4c-449b-975a-ab2a38374c61', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyDWVieq_pKnJAyIBp8M2iS0kYtHnUY8N2s', NULL, 1, 87, 4, 17, NULL, 'Request failed with status code 403', '2026-02-04 00:53:28', '2026-07-17 16:53:11'),
('c59c7904-d9d4-4a45-b2a3-5a5e053d8e40', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyBrqT0AEfeJJ3Xcecn27odcD3u92LhUWUQ', NULL, 1, 53, 3, 11, NULL, 'Request failed with status code 429', '2026-02-04 00:11:52', '2026-03-28 12:46:23'),
('c6eeb255-c45e-4fa3-8a69-80bcfaef65c2', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyAU_39_KsUvqYnRDseqYAVLjx1xoNGHDjQ', NULL, 1, 58, 4, 16, NULL, 'Request failed with status code 429', '2026-02-04 01:09:04', '2026-03-28 12:46:21'),
('c738c15c-cbdd-454c-909b-e553ab66fa6b', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyAcPyMnGU8YHV6rSfY_0pYwjbox4dkjuc8', NULL, 1, 42, 3, 14, NULL, 'Request failed with status code 429', '2026-02-04 01:06:24', '2026-03-28 12:46:28'),
('c978c00a-68c4-4306-9f09-5123952d628b', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyAmQV3QsAazv8tazkCkASTegzBxdeIbKcM', NULL, 1, 71, 5, 11, NULL, 'Request failed with status code 429', '2026-02-04 00:00:57', '2026-03-28 12:46:17'),
('cdf1ba7b-cfac-42ce-bea3-20b90f3b7c81', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyAEXZOiHlot7E8ct9x-3XosK4ytpNkx8PI', NULL, 1, 87, 5, 20, NULL, 'Request failed with status code 403', '2026-02-04 01:08:40', '2026-07-17 16:53:09'),
('cee97105-3c9b-47f1-acc3-0114235b1850', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyCGXUV7w1UTodJ7dt0myMUzuSmvectVEJE', NULL, 1, 48, 6, 11, NULL, 'Request failed with status code 429', '2026-02-04 01:14:57', '2026-03-28 12:46:26'),
('d0eb613e-54b1-4647-8afc-399f65f31387', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyA4-mBl-o4TdTueRuvn3ay0NFIFyy7JuR0', NULL, 1, 88, 7, 12, NULL, 'Request failed with status code 403', '2026-02-04 00:15:23', '2026-07-17 16:53:13'),
('d261e602-fa06-476a-8fc1-8f270144b3bb', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyDfdooSXw_Ou8-wHR8vMYktbSc79MH_0lM', NULL, 1, 77, 1, 11, NULL, 'Request failed with status code 429', '2026-02-04 01:01:38', '2026-03-28 12:46:15'),
('d308e3e5-66d0-4b73-9f2f-524f8ff942d0', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyDKduRal3j4tNO-fbMu5O26TELz9DvrWuQ', NULL, 1, 22, 4, 12, NULL, 'Request failed with status code 429', '2026-02-04 01:05:33', '2026-03-28 12:46:36'),
('d532083c-5c22-441c-a673-4d3397ca778a', 'd5165497-70e1-40dd-9619-693e32680f23', NULL, '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', NULL, 1, 11, 0, 1, NULL, 'Request failed with status code 400', '2026-02-03 23:59:19', '2026-02-16 12:47:28'),
('d5b94d5f-7fa7-4490-8e52-6ec92ccbd253', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyD2LFrQuss9BibPS9oMozhoT4AKLUau1WQ', NULL, 1, 29, 5, 11, NULL, 'Request failed with status code 429', '2026-02-04 00:00:55', '2026-03-28 12:46:33'),
('d755caa7-4e34-4c25-bf3a-86a771204349', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyCgoqeOS8qL9PoA42VFyEoOF37D53pAFSk', NULL, 1, 5, 4, 10, NULL, 'Request failed with status code 429', '2026-02-04 00:15:46', '2026-03-28 12:46:42'),
('d7d9dc36-6d69-402b-92c8-2a9e403447ec', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyAQMJweVt7eemxWcoQjchpVzTNbi364Agk', NULL, 1, 0, 7, 11, NULL, 'Request failed with status code 429', '2026-02-04 00:48:15', '2026-03-28 12:46:44'),
('d85e531f-7e68-49ec-979e-8ac31dcd610d', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyAcDQ5XfVHwGni-OQwSmRsyMI4s2OLKyBU', NULL, 1, 87, 1, 11, NULL, 'Request failed with status code 429', '2026-02-04 01:02:38', '2026-03-28 12:46:11'),
('d9dc371f-3e0e-4f66-8698-8014761c3d15', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyCXPT0xNKHZYQqAU2p_QQ_4Phhb2m-mBps', NULL, 1, 32, 0, 13, NULL, 'Request failed with status code 429', '2026-02-04 00:00:55', '2026-03-28 12:46:31'),
('dc04b772-062c-4a9e-b686-92e82631d086', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyBVO8elTNeBGjnx7w5gAE72CsAXKRqwfQk', NULL, 1, 50, 3, 11, NULL, 'Request failed with status code 429', '2026-02-04 00:49:18', '2026-03-28 12:46:24'),
('dd620a86-5196-4400-8286-35d8f2fce2fd', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyCufe5y75QB-YGHNTmD1mDXfzThwJkmBbc', NULL, 1, 87, 66, 12, NULL, 'Request failed with status code 403', '2026-02-04 00:19:23', '2026-07-17 16:53:10'),
('df31c8a4-98fb-4b6c-af1c-18663678e861', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyAWkQ0Oprbv2xdcukwJKwYyEERqINGBjs8', NULL, 1, 20, 1, 12, NULL, 'Request failed with status code 429', '2026-02-04 00:27:21', '2026-03-28 12:46:37'),
('e151f287-6f48-495e-987a-75006c4a56b0', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyDXmkpiB_wyRSzg3niTx4OeXvFgbV6eaQw', NULL, 1, 18, 2, 10, NULL, 'Request failed with status code 429', '2026-02-04 01:04:05', '2026-03-28 12:46:37'),
('e22d7687-b230-45ea-bed0-fd8b6ce18132', 'd5165497-70e1-40dd-9619-693e32680f23', NULL, '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', NULL, 1, 13, 0, 1, NULL, 'Request failed with status code 400', '2026-02-03 23:59:20', '2026-02-16 12:47:28'),
('e33e97df-fc3f-4fbe-9210-422ec771aa02', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyD-4J2JeMKAM5eQ00lRK-goZeOzZlCLvhY', NULL, 1, 59, 4, 8, NULL, 'Request failed with status code 429', '2026-02-04 00:00:56', '2026-03-28 12:46:21'),
('ebe65492-b813-438f-9e31-4d39df51318f', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyAirShg0hTYOdQULHeScNFI3W0ej02R8AM', NULL, 1, 43, 3, 11, NULL, 'Request failed with status code 429', '2026-02-04 01:01:12', '2026-03-28 12:46:28'),
('ed1256bb-471e-4934-b950-6f20cd184bbd', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyB7h7SSB7REqptga1mmCgvqxXef1UXk3HM', NULL, 1, 84, 4, 14, NULL, 'Request failed with status code 429', '2026-02-04 01:03:10', '2026-03-28 12:46:12'),
('ed35fe10-dba2-4e09-8872-9bb4ae5672f3', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyD9ZKhGAqExcqBn1ZUhiujxO0tieNBhuZA', NULL, 1, 78, 2, 11, NULL, 'Request failed with status code 429', '2026-02-04 01:11:46', '2026-03-28 12:46:14'),
('ed9ee1f2-7227-4f05-b6d3-e10adaf127a0', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyApkQeLKaqVWUW6df_yw0qWgJ1R5LzBPuA', NULL, 1, 1, 4, 9, NULL, 'Request failed with status code 429', '2026-02-04 00:20:23', '2026-03-28 12:46:43'),
('eda09e9e-625d-4113-962f-d6cdc47dcad6', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyCJ3D03QkHaVmAM436R9ly0sNwtS-iCGuE', NULL, 1, 75, 8, 8, NULL, 'Request failed with status code 429', '2026-02-04 00:18:47', '2026-03-28 12:46:15'),
('eec082db-7c23-4099-8a6a-432b60ad46d9', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyAgRqd1EL61xkfBCzsjVY6m-1DGsof3tL8', NULL, 1, 14, 1, 13, NULL, 'Request failed with status code 429', '2026-02-04 00:57:24', '2026-03-28 12:46:39'),
('f4618734-dbc7-42a4-b4b1-d12f2d767e38', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyCZXOvGY34BscQ2sxa2T6BeVq_OSDzcv2M', NULL, 1, 72, 6, 13, NULL, 'Request failed with status code 429', '2026-02-04 00:48:45', '2026-03-28 12:46:16'),
('f8262cf0-78e1-4226-9f28-f30372440778', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyC6AoNsSw5tFgDmjxa6LCut92KNQGnKRpM', NULL, 1, 17, 3, 9, NULL, 'Request failed with status code 429', '2026-02-04 00:10:17', '2026-03-28 12:46:38'),
('f84bd73b-81a6-451a-930f-46b5a62ac191', 'd5165497-70e1-40dd-9619-693e32680f23', NULL, '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', NULL, 1, 3, 0, 1, NULL, 'Request failed with status code 400', '2026-02-03 23:59:18', '2026-02-16 12:47:25'),
('f8dd4644-a2cb-4fa5-bbf3-c8f94105bbc0', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyBBz1nbPHnED7vTvXa0s4mG0LJS2jHpTxM', NULL, 1, 16, 5, 10, NULL, 'Request failed with status code 429', '2026-02-04 00:23:44', '2026-03-28 12:46:38'),
('fae21100-e07f-44bf-95f4-f7b56e2421ff', '5afea3eb-3686-45b8-a556-2d207b20053d', NULL, 'r8_HIMcnGmjvQxgaJWUhnFBC84AK0eYrgM25sz9t', NULL, 1, 0, 0, 2, NULL, 'Request failed with status code 404', '2026-02-04 02:07:22', '2026-02-04 02:08:36'),
('fc43142f-6298-459c-ad1b-87d2c0990c38', 'd5165497-70e1-40dd-9619-693e32680f23', NULL, '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', NULL, 1, 4, 0, 1, NULL, 'Request failed with status code 400', '2026-02-03 23:59:18', '2026-02-16 12:47:25'),
('fd02b977-de36-4292-a0a0-001087fff749', '1ff27993-b1c4-4732-ad46-3db3c7921750', NULL, 'AIzaSyDUJKRBtPoNCCJ-YrSeQSVXZpBqAG1gpHo', NULL, 1, 87, 4, 20, NULL, 'Request failed with status code 403', '2026-02-04 00:14:53', '2026-07-17 16:53:11');

-- --------------------------------------------------------

--
-- Table structure for table `provider_models`
--

CREATE TABLE `provider_models` (
  `id` varchar(36) NOT NULL,
  `provider_id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `model_id` varchar(255) NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `provider_models`
--

INSERT INTO `provider_models` (`id`, `provider_id`, `name`, `model_id`, `is_active`, `created_at`) VALUES
('0ba3a8ff-55f1-4c85-8bb9-6655734e5179', '1ff27993-b1c4-4732-ad46-3db3c7921750', 'gemini-2.5-pro', 'gemini-2.5-pro', 1, '2026-02-04 01:42:43'),
('2196cc48-71fe-4c3b-9aaf-7cdd47341330', 'd5165497-70e1-40dd-9619-693e32680f23', 'groq/image-gpt', 'groq/image-gpt', 1, '2026-02-04 02:18:06'),
('5ce3ce0d-5f40-4358-9b11-f49df29d5689', '5afea3eb-3686-45b8-a556-2d207b20053d', 'lucataco/sdxl-lightning', 'lucataco/sdxl-lightning', 1, '2026-02-04 02:06:48'),
('5dbdd067-573c-4faa-b964-2b6bc8693d71', 'd5165497-70e1-40dd-9619-693e32680f23', 'groq/vision-gpt-mini', 'groq/vision-gpt-mini', 1, '2026-02-04 02:18:06'),
('5de18eb0-e797-46ca-a30b-7819cdc0558f', '1ff27993-b1c4-4732-ad46-3db3c7921750', 'imagen-4.0-generate-001', 'imagen-4.0-generate-001', 1, '2026-02-04 01:42:43'),
('75b72657-a8a3-455c-8749-420b24ac2a8c', '5afea3eb-3686-45b8-a556-2d207b20053d', 'anotherjesse/zeroscope-v2-xl', 'anotherjesse/zeroscope-v2-xl', 1, '2026-02-04 02:06:48'),
('766de59a-653f-412a-829a-446dda9742b0', '1ff27993-b1c4-4732-ad46-3db3c7921750', 'gemini-3-pro-image-preview', 'gemini-3-pro-image-preview', 1, '2026-02-04 01:42:43'),
('7aa0dd27-ae30-4b5c-beaf-482d6c22b084', '1ff27993-b1c4-4732-ad46-3db3c7921750', 'gemini-2.5-flash', 'gemini-2.5-flash', 1, '2026-02-04 01:42:43'),
('b345bbdf-d27e-4cfc-ab48-a34ec56548d4', '1ff27993-b1c4-4732-ad46-3db3c7921750', 'gemini-2.5-flash-image', 'gemini-2.5-flash-image', 1, '2026-02-04 01:42:43'),
('bfe7f0e5-5022-4334-93ba-3951ea3b4ca1', 'd5165497-70e1-40dd-9619-693e32680f23', 'llama-3.1-8b-instant', 'llama-3.1-8b-instant', 1, '2026-02-04 02:18:06'),
('d7e4440f-cbfc-4c5f-abca-27c475816afe', 'd5165497-70e1-40dd-9619-693e32680f23', 'groq/vision-gpt-lb-large', 'groq/vision-gpt-lb-large', 1, '2026-02-04 02:18:06');

-- --------------------------------------------------------

--
-- Table structure for table `rotation_settings`
--

CREATE TABLE `rotation_settings` (
  `id` varchar(36) NOT NULL,
  `strategy` varchar(50) DEFAULT 'per_provider',
  `fallback_enabled` tinyint(1) DEFAULT 1,
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `rotation_settings`
--

INSERT INTO `rotation_settings` (`id`, `strategy`, `fallback_enabled`, `updated_at`) VALUES
('1e8a72a7-bd73-4de7-80ee-549bb3e5ea60', 'per_provider', 1, '2026-02-03 23:50:00');

-- --------------------------------------------------------

--
-- Table structure for table `unified_api_keys`
--

CREATE TABLE `unified_api_keys` (
  `id` varchar(36) NOT NULL,
  `api_key` varchar(255) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `total_requests` int(11) DEFAULT 0,
  `failed_requests` int(11) DEFAULT 0,
  `last_used_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `unified_api_keys`
--

INSERT INTO `unified_api_keys` (`id`, `api_key`, `name`, `is_active`, `total_requests`, `failed_requests`, `last_used_at`, `created_at`, `updated_at`) VALUES
('330c2425-3a81-44bd-9f8f-0af3c9e0c558', 'ok_LVcqtjxR6TplFpDXOgQBk7jhydGf4NaU', 'PRODUCTION', 1, 1179, 6, '2026-07-17 16:53:07', '2026-02-04 01:31:41', '2026-07-17 16:53:07');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` varchar(36) NOT NULL,
  `username` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `failed_login_attempts` int(11) DEFAULT 0,
  `last_failed_login_at` datetime DEFAULT NULL,
  `is_locked` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `username`, `password_hash`, `failed_login_attempts`, `last_failed_login_at`, `is_locked`, `created_at`, `updated_at`) VALUES
('0db156aa-1367-49a4-a3f1-3b1801b2d9be', 'admin', '$2b$10$AbDUcqp4EjiVTWyyEcIJEeehzIJoVLPg1cB0YZkCetUhyVcTmGaRC', 0, NULL, 0, '2026-02-03 23:56:05', '2026-02-03 23:56:05'),
('fc17786d-e5e8-4e6d-982f-a921909fde33', 'EKA', '$2b$10$mvDzrydiHo3A86rPQCxfk.d24cDA7cuLleK2TJQITjJDOyymM/NGq', 0, NULL, 0, '2026-02-03 23:51:32', '2026-02-03 23:55:29');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `api_usage_logs`
--
ALTER TABLE `api_usage_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `unified_key_id` (`unified_key_id`),
  ADD KEY `provider_id` (`provider_id`),
  ADD KEY `provider_key_id` (`provider_key_id`);

--
-- Indexes for table `providers`
--
ALTER TABLE `providers`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `provider_api_keys`
--
ALTER TABLE `provider_api_keys`
  ADD PRIMARY KEY (`id`),
  ADD KEY `provider_id` (`provider_id`),
  ADD KEY `model_id` (`model_id`);

--
-- Indexes for table `provider_models`
--
ALTER TABLE `provider_models`
  ADD PRIMARY KEY (`id`),
  ADD KEY `provider_id` (`provider_id`);

--
-- Indexes for table `rotation_settings`
--
ALTER TABLE `rotation_settings`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `unified_api_keys`
--
ALTER TABLE `unified_api_keys`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `api_key` (`api_key`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- Constraints for dumped tables
--

--
-- Constraints for table `api_usage_logs`
--
ALTER TABLE `api_usage_logs`
  ADD CONSTRAINT `api_usage_logs_ibfk_1` FOREIGN KEY (`unified_key_id`) REFERENCES `unified_api_keys` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `api_usage_logs_ibfk_2` FOREIGN KEY (`provider_id`) REFERENCES `providers` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `api_usage_logs_ibfk_3` FOREIGN KEY (`provider_key_id`) REFERENCES `provider_api_keys` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `provider_api_keys`
--
ALTER TABLE `provider_api_keys`
  ADD CONSTRAINT `provider_api_keys_ibfk_1` FOREIGN KEY (`provider_id`) REFERENCES `providers` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `provider_api_keys_ibfk_2` FOREIGN KEY (`model_id`) REFERENCES `provider_models` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `provider_models`
--
ALTER TABLE `provider_models`
  ADD CONSTRAINT `provider_models_ibfk_1` FOREIGN KEY (`provider_id`) REFERENCES `providers` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

import os

def rename_files(directory):
    # 获取当前目录下的所有文件
    files = [f for f in os.listdir(directory) if f.endswith('.jpg')]
    
    # 按文件名排序
    files.sort()
    
    # 遍历文件并重命名
    for index, filename in enumerate(files, start=1):
        # 生成新的文件名
        new_name = f"g{index}.jpg"
        
        # 获取文件的完整路径
        old_path = os.path.join(directory, filename)
        new_path = os.path.join(directory, new_name)
        
        # 重命名文件
        os.rename(old_path, new_path)
        print(f"Renamed: {filename} -> {new_name}")

if __name__ == "__main__":
    # 获取当前目录
    current_directory = os.getcwd()
    
    # 调用重命名函数
    rename_files(current_directory)
    print("All files have been renamed successfully!")
